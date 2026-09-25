import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { TypeScript } from "./extract.js";
import type { ErdModel } from "./model.js";

export type PageInput = {
    model: ErdModel;
    live: boolean;
    modelUrl: string | null;
    eventsUrl: string | null;
};

export type PageRenderer = (input: PageInput) => string;

type CompiledScript = {
    modified: number;
    code: string;
};

const escapeHtml = (text: string): string =>
    text
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");

/**
 * Renders the viewer as one self-contained HTML document: styles, script and model are inlined,
 * so the build copy opens straight from disk with no server.
 */
export const createPageRenderer = (ts: TypeScript, viewerDirectory: string): PageRenderer => {
    let compiled: CompiledScript | null = null;

    const script = (): string => {
        const path = join(viewerDirectory, "viewer.ts");
        const modified = statSync(path).mtimeMs;

        if (compiled?.modified !== modified) {
            const output = ts.transpileModule(readFileSync(path, "utf8"), {
                compilerOptions: {
                    target: ts.ScriptTarget.ES2022,
                    module: ts.ModuleKind.ESNext,
                },
            });

            compiled = { modified, code: output.outputText };
        }

        return compiled.code;
    };

    return (input) => {
        const template = readFileSync(join(viewerDirectory, "index.html"), "utf8");
        const style = readFileSync(join(viewerDirectory, "viewer.css"), "utf8");
        const data = JSON.stringify(input).replaceAll("<", "\\u003c");

        return template
            .replace("<!--erd:title-->", () => escapeHtml(input.model.project))
            .replace("<!--erd:style-->", () => `<style id="erd-style">\n${style}</style>`)
            .replace(
                "<!--erd:data-->",
                () => `<script id="erd-data" type="application/json">${data}</script>`,
            )
            .replace("<!--erd:script-->", () => `<script type="module">\n${script()}</script>`);
    };
};

export const renderFailurePage = (model: ErdModel): string => {
    const items = model.issues.map((issue) => `<li>${escapeHtml(issue.message)}</li>`).join("");

    return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><title>ERD</title></head><body style="font-family: system-ui, sans-serif; padding: 2rem"><h1>ERD unavailable</h1><ul>${items}</ul></body></html>`;
};
