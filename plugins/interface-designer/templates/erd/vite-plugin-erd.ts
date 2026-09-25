import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { ServerResponse } from "node:http";
import { createRequire } from "node:module";
import { basename, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import type { Logger, Plugin, ResolvedConfig, ViteDevServer } from "vite";
import { createExtractor, type Extraction, type Extractor, type TypeScript } from "./extract.js";
import { renderMarkdown, renderMermaid } from "./mermaid.js";
import type { ErdIssue, ErdModel } from "./model.js";
import {
    createPageRenderer,
    type PageInput,
    type PageRenderer,
    renderFailurePage,
} from "./page.js";

export type ErdOptions = {
    /** Files or folders, relative to the project root, that declare the entity types. */
    include?: string[];
    /** URL path the live diagram is served at. */
    path?: string;
    /** Markdown snapshot rewritten on every model change, relative to the root; `false` skips it. */
    output?: string | false;
    /** Writes a static copy of the diagram into the build output at `{path}/index.html`. */
    emit?: boolean;
};

type Settings = {
    root: string;
    include: string[];
    path: string;
    output: string | false;
};

type Engine =
    | { ready: true; extractor: Extractor; renderPage: PageRenderer }
    | { ready: false; failure: string };

type Generator = {
    generate: () => ErdModel;
    watches: (file: string) => boolean;
    page: (input: PageInput) => string;
};

const colorize =
    process.env.NO_COLOR === undefined &&
    (process.env.FORCE_COLOR !== undefined || process.stdout.isTTY === true);

const paint =
    (open: number, close: number) =>
    (text: string): string =>
        colorize ? `\u001b[${open}m${text}\u001b[${close}m` : text;

const green = paint(32, 39);
const cyan = paint(36, 39);
const bold = paint(1, 22);

const errorMessage = (error: unknown): string =>
    error instanceof Error ? error.message : String(error);

const counted = (count: number, singular: string, plural: string): string =>
    `${count} ${count === 1 ? singular : plural}`;

const formatIssue = (issue: ErdIssue): string =>
    issue.file === null ? issue.message : `${issue.file}:${issue.line ?? 1} ${issue.message}`;

const summarize = (model: ErdModel): string => {
    const entities = model.entities.filter((entity) => entity.kind === "entity").length;
    const parts = [
        counted(entities, "entity", "entities"),
        counted(model.relations.length, "relationship", "relationships"),
    ];

    if (model.issues.length > 0) {
        parts.push(counted(model.issues.length, "warning", "warnings"));
    }

    return parts.join(", ");
};

const describeChange = (previous: ErdModel, next: ErdModel): string => {
    const before = new Map(
        previous.entities.map((entity) => [entity.name, JSON.stringify(entity)]),
    );
    const after = new Map(next.entities.map((entity) => [entity.name, JSON.stringify(entity)]));
    const changes = [
        ...[...after.keys()].filter((name) => !before.has(name)).map((name) => `+${name}`),
        ...[...after.keys()]
            .filter((name) => before.has(name) && before.get(name) !== after.get(name))
            .map((name) => `~${name}`),
        ...[...before.keys()].filter((name) => !after.has(name)).map((name) => `-${name}`),
    ];

    return changes.length === 0 ? "" : ` (${changes.join(", ")})`;
};

const routeOf = (pathname: string, mount: string): string | null => {
    if (pathname === mount || pathname === `${mount}/`) {
        return "";
    }

    return pathname.startsWith(`${mount}/`) ? pathname.slice(mount.length + 1) : null;
};

const readText = (path: string): string | null =>
    existsSync(path) ? readFileSync(path, "utf8") : null;

const projectName = (root: string): string => {
    const title = /<title>([^<]*)<\/title>/i.exec(readText(join(root, "index.html")) ?? "")?.[1];

    if (title !== undefined && title.trim() !== "" && !title.includes("{{")) {
        return title.trim();
    }

    const manifest = readText(join(root, "package.json"));
    const name: unknown = manifest === null ? undefined : JSON.parse(manifest).name;

    return typeof name === "string" && name !== "" ? name : basename(root);
};

const writeIfChanged = (path: string, content: string): void => {
    if (readText(path) !== content) {
        writeFileSync(path, content);
    }
};

const viewerDirectory = (root: string): string => {
    const beside = fileURLToPath(new URL("./viewer/", import.meta.url));

    return existsSync(join(beside, "index.html")) ? beside : join(root, "erd", "viewer");
};

const failedExtraction = (message: string): Extraction => ({
    files: [],
    entities: [],
    relations: [],
    issues: [{ level: "error", message, entity: null, field: null, file: null, line: null }],
});

const loadEngine = (settings: Settings): Engine => {
    let ts: TypeScript;

    try {
        ts = createRequire(join(settings.root, "package.json"))("typescript");
    } catch (error) {
        return {
            ready: false,
            failure: `The ERD reads entity types with the project's typescript package, which failed to load: ${errorMessage(error)}`,
        };
    }

    if (typeof ts.createProgram !== "function") {
        return {
            ready: false,
            failure: `typescript ${ts.version} does not expose the compiler API the ERD reads types with; keep typescript on 6.x or earlier.`,
        };
    }

    return {
        ready: true,
        extractor: createExtractor(ts, settings.root, settings.include),
        renderPage: createPageRenderer(ts, viewerDirectory(settings.root)),
    };
};

const createGenerator = (settings: Settings): Generator => {
    const project = projectName(settings.root);
    const includeRoots = settings.include.map((path) => resolve(settings.root, path));
    let engine: Engine | undefined;

    const load = (): Engine => {
        engine ??= loadEngine(settings);

        return engine;
    };

    const extract = (): Extraction => {
        const loaded = load();

        if (!loaded.ready) {
            return failedExtraction(loaded.failure);
        }

        try {
            return loaded.extractor.run();
        } catch (error) {
            return failedExtraction(`Reading the entity types failed: ${errorMessage(error)}`);
        }
    };

    const generate = (): ErdModel => {
        const extraction = extract();
        const mermaid = renderMermaid(extraction);
        const hash = createHash("sha1")
            .update(
                JSON.stringify([
                    settings.include,
                    extraction.entities,
                    extraction.relations,
                    extraction.issues,
                ]),
            )
            .digest("hex")
            .slice(0, 12);

        if (settings.output !== false) {
            writeIfChanged(
                resolve(settings.root, settings.output),
                renderMarkdown({
                    project,
                    include: settings.include,
                    path: settings.path,
                    mermaid,
                    issues: extraction.issues,
                }),
            );
        }

        return { project, include: settings.include, ...extraction, mermaid, hash };
    };

    const watches = (file: string): boolean => {
        if (engine?.ready === true) {
            return engine.extractor.watches(file);
        }

        const absolute = resolve(file);

        return includeRoots.some(
            (includeRoot) =>
                absolute === includeRoot || absolute.startsWith(`${includeRoot}${sep}`),
        );
    };

    const page = (input: PageInput): string => {
        const loaded = load();

        return loaded.ready ? loaded.renderPage(input) : renderFailurePage(input.model);
    };

    return { generate, watches, page };
};

const report = (logger: Logger, previous: ErdModel | undefined, next: ErdModel): void => {
    const change = previous === undefined ? "" : describeChange(previous, next);
    const known = new Set(previous?.issues.map((issue) => issue.message));

    logger.info(`[erd] ${summarize(next)}${change}`, { timestamp: true });

    for (const issue of next.issues) {
        if (!known.has(issue.message)) {
            logger.warn(`[erd] ${formatIssue(issue)}`, { timestamp: true });
        }
    }
};

const serve = (
    server: ViteDevServer,
    generator: Generator,
    path: string,
    clients: Set<ServerResponse>,
): void => {
    const { logger } = server.config;
    const mount = `${server.config.base.replace(/\/+$/, "")}${path}`;
    let current: ErdModel | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const send = (client: ServerResponse, model: ErdModel): void => {
        client.write(`event: model\ndata: ${JSON.stringify(model)}\n\n`);
    };

    const refresh = (): ErdModel => {
        const previous = current;
        const model = generator.generate();

        current = model;

        if (previous?.hash !== model.hash) {
            for (const client of clients) {
                send(client, model);
            }

            report(logger, previous, model);
        }

        return model;
    };

    const latest = (): ErdModel => current ?? refresh();

    const refreshInBackground = (): void => {
        try {
            refresh();
        } catch (error) {
            logger.error(`[erd] ${errorMessage(error)}`, { timestamp: true });
        }
    };

    const respond = (route: string, response: ServerResponse, trackClose: () => void): boolean => {
        switch (route) {
            case "":
                response.writeHead(200, {
                    "Content-Type": "text/html; charset=utf-8",
                    "Cache-Control": "no-store",
                });
                response.end(
                    generator.page({
                        model: latest(),
                        live: true,
                        modelUrl: `${mount}/model.json`,
                        eventsUrl: `${mount}/events`,
                    }),
                );

                return true;
            case "model.json":
                response.writeHead(200, {
                    "Content-Type": "application/json; charset=utf-8",
                    "Cache-Control": "no-store",
                });
                response.end(JSON.stringify(latest()));

                return true;
            case "erd.mmd":
                response.writeHead(200, {
                    "Content-Type": "text/plain; charset=utf-8",
                    "Cache-Control": "no-store",
                });
                response.end(latest().mermaid);

                return true;
            case "events":
                response.writeHead(200, {
                    "Content-Type": "text/event-stream",
                    "Cache-Control": "no-store",
                    Connection: "keep-alive",
                });
                response.write("retry: 2000\n\n");
                clients.add(response);
                trackClose();
                send(response, latest());

                return true;
            default:
                return false;
        }
    };

    server.middlewares.use((request, response, next) => {
        const route = routeOf((request.url ?? "").split("?")[0] ?? "", mount);

        if (route === null) {
            next();

            return;
        }

        try {
            const handled = respond(route, response, () =>
                request.on("close", () => clients.delete(response)),
            );

            if (!handled) {
                next();
            }
        } catch (error) {
            response.statusCode = 500;
            response.end(`ERD failed: ${errorMessage(error)}`);
        }
    });

    server.watcher.on("all", (_event: string, file: string) => {
        if (!generator.watches(file)) {
            return;
        }

        clearTimeout(timer);
        timer = setTimeout(refreshInBackground, 150);
    });

    const heartbeat = setInterval(() => {
        for (const client of clients) {
            client.write(": keep-alive\n\n");
        }
    }, 25_000);

    heartbeat.unref();
    server.httpServer?.once("close", () => clearInterval(heartbeat));

    const printUrls = server.printUrls.bind(server);

    server.printUrls = () => {
        printUrls();

        const local = server.resolvedUrls?.local[0];

        if (local !== undefined) {
            logger.info(`  ${green("➜")}  ${bold("ERD")}:     ${cyan(new URL(mount, local).href)}`);
        }
    };

    setTimeout(refreshInBackground, 1000).unref();
};

/**
 * Draws the mock's entity relationships from its TypeScript types.
 *
 * Serves a live diagram at `path` on the dev server, rewrites `output` whenever an entity type
 * changes, and on build logs every warning and writes a static copy of the diagram.
 */
export const erd = (options: ErdOptions = {}): Plugin => {
    const path = `/${(options.path ?? "erd").replace(/^\/+|\/+$/g, "")}`;
    const include = options.include ?? ["src/types"];
    const output = options.output ?? "ERD.md";
    const emit = options.emit ?? true;
    const clients = new Set<ServerResponse>();
    let config: ResolvedConfig | undefined;
    let generator: Generator | undefined;
    let built: ErdModel | undefined;

    const generatorFor = (resolved: ResolvedConfig): Generator => {
        generator ??= createGenerator({ root: resolved.root, include, path, output });

        return generator;
    };

    return {
        name: "erd",
        configResolved(resolved) {
            config = resolved;
        },
        configureServer(server) {
            serve(server, generatorFor(server.config), path, clients);
        },
        configurePreviewServer(server) {
            const mount = `${server.config.base.replace(/\/+$/, "")}${path}`;

            server.middlewares.use((request, response, next) => {
                if (!emit || (request.url ?? "").split("?")[0] !== mount) {
                    next();

                    return;
                }

                response.writeHead(302, { Location: `${mount}/` });
                response.end();
            });
        },
        buildStart() {
            if (config?.command !== "build") {
                return;
            }

            built = generatorFor(config).generate();
            config.logger.info(`[erd] ${summarize(built)}`);

            for (const issue of built.issues) {
                this.warn(formatIssue(issue));
            }
        },
        generateBundle() {
            if (config?.command !== "build" || !emit || built === undefined) {
                return;
            }

            this.emitFile({
                type: "asset",
                fileName: `${path.slice(1)}/index.html`,
                source: generatorFor(config).page({
                    model: built,
                    live: false,
                    modelUrl: null,
                    eventsUrl: null,
                }),
            });
        },
        closeBundle() {
            for (const client of clients) {
                client.end();
            }

            clients.clear();
        },
    };
};
