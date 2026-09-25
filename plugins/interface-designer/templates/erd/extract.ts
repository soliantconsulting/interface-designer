import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import type TS from "typescript";
import type { ErdEntity, ErdIssue, ErdRelation, ErdRelationSource } from "./model.js";

export type TypeScript = typeof TS;

export type Extraction = {
    files: string[];
    entities: ErdEntity[];
    relations: ErdRelation[];
    issues: ErdIssue[];
};

export type Extractor = {
    run: () => Extraction;
    watches: (file: string) => boolean;
};

type Identity = "entity" | "auto" | "plain";

type Declaration = TS.InterfaceDeclaration | TS.TypeAliasDeclaration;

type Location = {
    file: string;
    line: number;
};

type Candidate = Location & {
    name: string;
    words: string[];
    symbol: TS.Symbol;
    declaration: Declaration;
    properties: TS.Symbol[];
    tags: Map<string, string>;
    description: string | null;
    identity: Identity;
    pk: string | null;
};

type FieldInfo = Location & {
    name: string;
    type: string;
    declared: boolean;
    optional: boolean;
    nullable: boolean;
    array: boolean;
    refs: string[];
    external: string | null;
    description: string | null;
    element: TS.Type;
    keyLike: boolean;
    refTag: string | null;
};

type Acceptance = (candidate: Candidate) => boolean;

type Unlinked = {
    owner: Candidate;
    info: FieldInfo;
    prefix: string;
    accepts: Acceptance;
    required: boolean;
};

type Declared = {
    statement: Declaration;
    symbol: TS.Symbol;
    type: TS.Type;
};

type Duplicate = Location & {
    first: Candidate;
};

type CachedSource = {
    modified: number;
    sourceFile: TS.SourceFile;
};

type RefTarget = {
    name: string;
    field: string | null;
};

const SOURCE_FILE = /\.(c|m)?tsx?$/;
const SKIPPED_FILE = /\.(test|spec|stories|gen)\.(c|m)?tsx?$/;
const PROJECTION_TYPES = new Set([
    "Pick",
    "Omit",
    "Partial",
    "Required",
    "Readonly",
    "NonNullable",
]);
const NATURAL_KEYS = ["id", "code", "key", "slug", "uuid"];
const REFERENCE_NAME = /^(.+?)(Ids?|IDs?|_ids?)$/;
const KEY_NAME = /^(.+?)(Codes?|Keys?|_codes?|_keys?)$/;
const REF_TARGET = /^([A-Za-z_$][\w$]*)(?:\.([A-Za-z_$][\w$]*))?/;

/** The prefix JSON:API clients give a list-row type (`ListDevice`) that names the resource. */
const LIST_ROW = /^List(?=[A-Z])/;

/**
 * Types embedded in this many different records are shared value types (a provenance stamp, an
 * address), not child entities, even when they carry an `id`.
 */
const SHARED_VALUE_OWNERS = 3;

const ownerCount = (embeddedBy: Map<Candidate, Set<Candidate>>, candidate: Candidate): number =>
    embeddedBy.get(candidate)?.size ?? 0;

const isSourceFile = (path: string): boolean => SOURCE_FILE.test(path) && !SKIPPED_FILE.test(path);

const toPosix = (path: string): string => path.split(sep).join("/");

const collapse = (text: string): string => text.replace(/\s+/g, " ").trim();

const firstParagraph = (text: string): string | null => {
    const paragraph = collapse(text.split(/\n\s*\n/)[0] ?? "");

    return paragraph === "" ? null : paragraph;
};

const splitWords = (name: string): string[] =>
    name
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
        .split(/[\s_$-]+/)
        .filter((word) => word !== "")
        .map((word) => word.toLowerCase());

const singularize = (word: string): string => {
    if (word.endsWith("ies")) {
        return `${word.slice(0, -3)}y`;
    }

    if (word.endsWith("s") && !word.endsWith("ss")) {
        return word.slice(0, -1);
    }

    return word;
};

const endsWithWords = (words: string[], ending: string[]): boolean =>
    ending.length <= words.length &&
    ending.every((word, index) => words[words.length - ending.length + index] === word);

const compareIssues = (left: ErdIssue, right: ErdIssue): number => {
    const byFile = (left.file ?? "").localeCompare(right.file ?? "");

    return byFile === 0 ? (left.line ?? 0) - (right.line ?? 0) : byFile;
};

const shapeText = (base: string, array: boolean, nullable: boolean): string =>
    `${base}${array ? "[]" : ""}${nullable ? " | null" : ""}`;

const externalSystem = (tags: Map<string, string>): string | null => {
    const system = tags.get("external");

    if (system === undefined) {
        return null;
    }

    return system === "" ? "external" : system;
};

const collectFiles = (root: string, include: string[], missing: string[]): string[] => {
    const files = new Set<string>();

    const walk = (directory: string): void => {
        for (const entry of readdirSync(directory, { withFileTypes: true })) {
            if (entry.name.startsWith(".") || entry.name === "node_modules") {
                continue;
            }

            const child = join(directory, entry.name);

            if (entry.isDirectory()) {
                walk(child);
            } else if (isSourceFile(entry.name)) {
                files.add(child);
            }
        }
    };

    for (const path of include) {
        const absolute = resolve(root, path);
        const stats = statSync(absolute, { throwIfNoEntry: false });

        if (stats === undefined) {
            missing.push(path);
        } else if (stats.isDirectory()) {
            walk(absolute);
        } else if (isSourceFile(absolute)) {
            files.add(absolute);
        }
    }

    return [...files].sort();
};

const readCompilerOptions = (ts: TypeScript, root: string): TS.CompilerOptions => {
    for (const name of ["tsconfig.app.json", "tsconfig.json"]) {
        const path = join(root, name);

        if (!existsSync(path)) {
            continue;
        }

        const config = ts.readConfigFile(path, ts.sys.readFile);

        if (config.error !== undefined) {
            continue;
        }

        return ts.parseJsonConfigFileContent(config.config, ts.sys, root, undefined, path).options;
    }

    return {};
};

const createHost = (
    ts: TypeScript,
    options: TS.CompilerOptions,
    cache: Map<string, CachedSource>,
): TS.CompilerHost => {
    const host = ts.createCompilerHost(options, true);
    const read = host.getSourceFile.bind(host);

    host.getSourceFile = (fileName, languageVersion, onError, shouldCreate) => {
        const modified = statSync(fileName, { throwIfNoEntry: false })?.mtimeMs ?? -1;
        const cached = cache.get(fileName);

        if (cached !== undefined && cached.modified === modified) {
            return cached.sourceFile;
        }

        const sourceFile = read(fileName, languageVersion, onError, shouldCreate);

        if (sourceFile !== undefined) {
            cache.set(fileName, { modified, sourceFile });
        }

        return sourceFile;
    };

    return host;
};

const parseRefTag = (text: string): RefTarget[] | "none" => {
    const cleaned = text.replace(/[{}]/g, " ").trim();

    if (/^none\b/i.test(cleaned)) {
        return "none";
    }

    const targets: RefTarget[] = [];

    for (const part of cleaned.split(/[|,]/)) {
        const match = REF_TARGET.exec(part.trim());

        if (match?.[1] !== undefined) {
            targets.push({ name: match[1], field: match[2] ?? null });
        }
    }

    return targets;
};

/**
 * Creates an extractor that reads entity types from `include` (files or folders under `root`).
 *
 * Each `run()` builds a fresh TypeScript program but reuses parsed source files whose mtime has
 * not changed, so only edited files are parsed again.
 */
export const createExtractor = (ts: TypeScript, root: string, include: string[]): Extractor => {
    const options: TS.CompilerOptions = {
        ...readCompilerOptions(ts, root),
        noEmit: true,
        skipLibCheck: true,
        strict: true,
        strictNullChecks: true,
        incremental: false,
        composite: false,
        declaration: false,
        tsBuildInfoFile: undefined,
    };
    const host = createHost(ts, options, new Map());
    const includeRoots = include.map((path) => resolve(root, path));
    let previous: TS.Program | undefined;
    let dependencies = new Set<string>();

    const watches = (file: string): boolean => {
        const absolute = resolve(file);

        if (dependencies.has(absolute)) {
            return true;
        }

        return (
            isSourceFile(absolute) &&
            includeRoots.some(
                (includeRoot) =>
                    absolute === includeRoot || absolute.startsWith(`${includeRoot}${sep}`),
            )
        );
    };

    const run = (): Extraction => {
        const missing: string[] = [];
        const files = collectFiles(root, include, missing);
        const program = ts.createProgram({
            rootNames: files,
            options,
            host,
            oldProgram: previous,
        });

        previous = program;
        dependencies = new Set(
            program
                .getSourceFiles()
                .filter(
                    (sourceFile) =>
                        !program.isSourceFileDefaultLibrary(sourceFile) &&
                        !sourceFile.fileName.includes("/node_modules/"),
                )
                .map((sourceFile) => resolve(sourceFile.fileName)),
        );

        const extraction = analyze(ts, program, root, files);

        for (const path of missing) {
            extraction.issues.unshift({
                level: "warning",
                message: `ERD include path "${path}" does not exist.`,
                entity: null,
                field: null,
                file: null,
                line: null,
            });
        }

        return extraction;
    };

    return { run, watches };
};

const analyze = (
    ts: TypeScript,
    program: TS.Program,
    root: string,
    files: string[],
): Extraction => {
    const checker = program.getTypeChecker();
    const issues: ErdIssue[] = [];
    const candidates = new Map<string, Candidate>();
    const bySymbol = new Map<TS.Symbol, Candidate>();
    const fieldCache = new Map<Candidate, FieldInfo[]>();

    const locate = (node: TS.Node): Location => {
        const sourceFile = node.getSourceFile();
        const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));

        return { file: toPosix(relative(root, sourceFile.fileName)), line: line + 1 };
    };

    const exportedSymbols = (sourceFile: TS.SourceFile): Set<TS.Symbol> => {
        const moduleSymbol = checker.getSymbolAtLocation(sourceFile);

        if (moduleSymbol === undefined) {
            return new Set();
        }

        return new Set(
            checker
                .getExportsOfModule(moduleSymbol)
                .map((symbol) =>
                    (symbol.flags & ts.SymbolFlags.Alias) === 0
                        ? symbol
                        : checker.getAliasedSymbol(symbol),
                ),
        );
    };

    const tagsOf = (declaration: Declaration): Map<string, string> => {
        const tags = new Map<string, string>();

        for (const tag of ts.getJSDocTags(declaration)) {
            tags.set(tag.tagName.text, collapse(ts.getTextOfJSDocComment(tag.comment) ?? ""));
        }

        return tags;
    };

    const isObjectLike = (type: TS.Type): boolean =>
        (type.flags & (ts.TypeFlags.Object | ts.TypeFlags.Intersection)) !== 0 &&
        !checker.isArrayType(type) &&
        !checker.isTupleType(type) &&
        type.getCallSignatures().length === 0;

    const isKeyLike = (type: TS.Type): boolean => {
        const keyFlags = ts.TypeFlags.StringLike | ts.TypeFlags.NumberLike;

        if (type.isUnion()) {
            return type.types.every((member) => (member.flags & keyFlags) !== 0);
        }

        if (type.isIntersection()) {
            return type.types.some((member) => (member.flags & keyFlags) !== 0);
        }

        return (type.flags & keyFlags) !== 0;
    };

    const hasId = (type: TS.Type): boolean =>
        checker.getPropertiesOfType(type).some((property) => property.name === "id");

    const symbolOf = (type: TS.Type): TS.Symbol | undefined => type.aliasSymbol ?? type.getSymbol();

    const declared: Declared[] = [];
    const duplicates: Duplicate[] = [];
    const seen = new Set<TS.Symbol>();

    for (const fileName of files) {
        const sourceFile = program.getSourceFile(fileName);

        if (sourceFile === undefined) {
            continue;
        }

        const exported = exportedSymbols(sourceFile);

        for (const statement of sourceFile.statements) {
            if (!ts.isInterfaceDeclaration(statement) && !ts.isTypeAliasDeclaration(statement)) {
                continue;
            }

            const symbol = checker.getSymbolAtLocation(statement.name);

            if (
                statement.typeParameters !== undefined ||
                symbol === undefined ||
                !exported.has(symbol) ||
                seen.has(symbol)
            ) {
                continue;
            }

            const type = checker.getDeclaredTypeOfSymbol(symbol);

            seen.add(symbol);

            if (isObjectLike(type)) {
                declared.push({ statement, symbol, type });
            }
        }
    }

    const resourceOf = (type: TS.Type): TS.Type => {
        const properties = checker.getPropertiesOfType(type);
        const data = properties.find((property) => property.name === "data");

        if (data === undefined || properties.some((property) => property.name === "id")) {
            return type;
        }

        const resource = checker.getNonNullableType(checker.getTypeOfSymbol(data));
        const resourceSymbol = symbolOf(resource);
        const anonymous = resourceSymbol === undefined || !seen.has(resourceSymbol);

        return anonymous && isObjectLike(resource) && hasId(resource) ? resource : type;
    };

    for (const { statement, symbol, type } of declared) {
        const properties = checker.getPropertiesOfType(resourceOf(type));

        if (properties.length === 0) {
            continue;
        }

        const name = statement.name.text;
        const location = locate(statement);
        const existing = candidates.get(name);

        if (existing !== undefined) {
            duplicates.push({ first: existing, ...location });
            continue;
        }

        const candidate: Candidate = {
            ...location,
            name,
            words: splitWords(name.replace(LIST_ROW, "")),
            symbol,
            declaration: statement,
            properties,
            tags: tagsOf(statement),
            description: firstParagraph(
                ts.displayPartsToString(symbol.getDocumentationComment(checker)),
            ),
            identity: "plain",
            pk: null,
        };

        candidates.set(name, candidate);
        bySymbol.set(symbol, candidate);
    }

    const hasProperty = (candidate: Candidate, name: string): boolean =>
        candidate.properties.some((property) => property.name === name);

    const rootName = (node: TS.TypeNode): string | null => {
        if (ts.isIndexedAccessTypeNode(node)) {
            return rootName(node.objectType);
        }

        if (ts.isParenthesizedTypeNode(node)) {
            return rootName(node.type);
        }

        return ts.isTypeReferenceNode(node) ? node.typeName.getText() : null;
    };

    const isProjection = (declaration: Declaration): boolean => {
        if (!ts.isTypeAliasDeclaration(declaration)) {
            return false;
        }

        const referenced = rootName(declaration.type);

        if (
            referenced === null ||
            !(PROJECTION_TYPES.has(referenced) || candidates.has(referenced))
        ) {
            return false;
        }

        if (!ts.isIndexedAccessTypeNode(declaration.type)) {
            return true;
        }

        const resource = declaration.name.text.replace(LIST_ROW, "");

        return resource === declaration.name.text || candidates.has(resource);
    };

    const isEntity = (candidate: Candidate): boolean =>
        candidate.identity === "entity" || candidate.identity === "auto";

    for (const candidate of candidates.values()) {
        const entityTag = candidate.tags.get("entity");
        const taggedKey = entityTag?.split(" ")[0] ?? "";

        if (candidate.tags.has("notEntity")) {
            candidate.identity = "plain";
        } else if (entityTag !== undefined) {
            candidate.identity = "entity";
        } else if (!isProjection(candidate.declaration) && hasProperty(candidate, "id")) {
            candidate.identity = "auto";
        }

        candidate.pk =
            taggedKey !== "" && hasProperty(candidate, taggedKey)
                ? taggedKey
                : (NATURAL_KEYS.find((key) => hasProperty(candidate, key)) ?? null);
    }

    const fieldsOf = (candidate: Candidate): FieldInfo[] => {
        const cached = fieldCache.get(candidate);

        if (cached !== undefined) {
            return cached;
        }

        const fields = candidate.properties.map((property): FieldInfo => {
            const declaration = property.valueDeclaration ?? property.declarations?.[0];
            const type = checker.getTypeOfSymbol(property);
            const optional = (property.flags & ts.SymbolFlags.Optional) !== 0;
            const members = type.isUnion() ? type.types : [type];
            const core = checker.getNonNullableType(type);
            const array = checker.isArrayType(core);
            const element = array
                ? (checker.getIndexTypeOfType(core, ts.IndexKind.Number) ?? core)
                : core;
            const tags = new Map(
                property
                    .getJsDocTags(checker)
                    .map((tag) => [tag.name, collapse(ts.displayPartsToString(tag.text))]),
            );
            const declaredType =
                declaration !== undefined &&
                (ts.isPropertySignature(declaration) || ts.isPropertyDeclaration(declaration)) &&
                declaration.type !== undefined
                    ? collapse(declaration.type.getText())
                    : null;
            const nullable = members.some((member) => (member.flags & ts.TypeFlags.Null) !== 0);
            const inferred = checker
                .typeToString(type, undefined, ts.TypeFormatFlags.NoTruncation)
                .replace(/ \| undefined$/, "");

            return {
                ...(declaration === undefined
                    ? { file: candidate.file, line: candidate.line }
                    : locate(declaration)),
                name: property.name,
                type:
                    declaredType ??
                    (inferred.length > 60 && isObjectLike(element)
                        ? shapeText("{…}", array, nullable)
                        : inferred),
                declared: declaredType !== null,
                optional,
                nullable,
                array,
                refs: [],
                external: externalSystem(tags),
                description: firstParagraph(
                    ts.displayPartsToString(property.getDocumentationComment(checker)),
                ),
                element,
                keyLike: isKeyLike(element),
                refTag: tags.get("ref") ?? null,
            };
        });

        fieldCache.set(candidate, fields);

        return fields;
    };

    const resolveName = (prefix: string, accepts: Acceptance): Candidate | null => {
        const words = splitWords(prefix);
        const byKey = new Map(
            [...candidates.values()]
                .filter(accepts)
                .map((candidate) => [candidate.words.join(""), candidate]),
        );

        for (let start = 0; start < words.length; start += 1) {
            const tail = words.slice(start);
            const exact =
                byKey.get(tail.join("")) ??
                byKey.get(
                    [...tail.slice(0, -1), singularize(tail[tail.length - 1] ?? "")].join(""),
                );

            if (exact !== undefined) {
                return exact;
            }
        }

        return null;
    };

    /**
     * Finds the one type whose name ends with the prefix's words (`slot` for `PhotoSlot`).
     *
     * Only ever a suggestion, never a line: the longer name is as often a different record
     * (a `box` holding a catalog box reads as `ProjectBox`), and a wrong line is worse than none.
     */
    const suggestName = (prefix: string, accepts: Acceptance): Candidate | null => {
        const words = splitWords(prefix);
        const endings = [...candidates.values()].filter(
            (candidate) => accepts(candidate) && endsWithWords(candidate.words, words),
        );

        return endings.length === 1 ? (endings[0] ?? null) : null;
    };

    const relations: ErdRelation[] = [];
    const referenced = new Set<Candidate>();
    const embeddedBy = new Map<Candidate, Set<Candidate>>();
    const queue = [...candidates.values()].filter(isEntity);
    const processed = new Set<Candidate>();
    let unlinked: Unlinked[] = [];

    const addRelation = (
        owner: Candidate,
        info: FieldInfo,
        target: Candidate,
        toField: string | null,
        source: ErdRelationSource,
        polymorphic: boolean,
    ): void => {
        const kind = source === "type" ? "embedded" : "reference";

        relations.push({
            id: `${owner.name}.${info.name}>${target.name}`,
            kind,
            from: owner.name,
            field: info.name,
            to: target.name,
            toField,
            many: info.array,
            optional: info.optional || info.nullable,
            source,
            polymorphic,
        });
        queue.push(target);

        if (kind === "reference") {
            info.refs.push(target.name);
            referenced.add(target);

            return;
        }

        const owners = embeddedBy.get(target) ?? new Set<Candidate>();

        owners.add(owner);
        embeddedBy.set(target, owners);
    };

    const promote = (candidate: Candidate, key: string): void => {
        if (!isEntity(candidate)) {
            candidate.identity = "entity";
            candidate.pk = key;
        }
    };

    const linkByName = (owner: Candidate, info: FieldInfo, prefix: string): boolean => {
        const target = resolveName(prefix, isEntity);

        if (target === null) {
            return false;
        }

        addRelation(owner, info, target, target.pk, "name", false);

        return true;
    };

    const linkTagged = (owner: Candidate, info: FieldInfo, targets: RefTarget[]): void => {
        for (const target of targets) {
            const candidate = candidates.get(target.name);

            if (candidate === undefined) {
                issues.push({
                    level: "error",
                    message: `${owner.name}.${info.name} is tagged @ref ${target.name}, but no exported type in the ERD sources is named ${target.name}.`,
                    entity: owner.name,
                    field: info.name,
                    file: info.file,
                    line: info.line,
                });
                continue;
            }

            const key = target.field ?? candidate.pk ?? "id";

            promote(candidate, key);
            addRelation(owner, info, candidate, key, "tag", targets.length > 1);
        }
    };

    const connect = (owner: Candidate): void => {
        for (const info of fieldsOf(owner)) {
            if (info.refTag !== null) {
                const targets = parseRefTag(info.refTag);

                if (targets !== "none") {
                    linkTagged(owner, info, targets);
                }

                continue;
            }

            const elementSymbol = symbolOf(info.element);
            const embedded = elementSymbol === undefined ? undefined : bySymbol.get(elementSymbol);

            if (embedded !== undefined) {
                addRelation(owner, info, embedded, null, "type", false);
                continue;
            }

            if (isObjectLike(info.element) && hasId(info.element)) {
                const resource = resolveName(info.name, isEntity);

                if (resource !== null) {
                    addRelation(owner, info, resource, resource.pk, "name", false);
                    info.type = info.declared
                        ? info.type
                        : shapeText(resource.name, info.array, info.nullable);
                }

                continue;
            }

            if (!info.keyLike || info.name === owner.pk || info.external !== null) {
                continue;
            }

            const reference = REFERENCE_NAME.exec(info.name)?.[1];

            if (reference !== undefined) {
                if (!linkByName(owner, info, reference)) {
                    unlinked.push({
                        owner,
                        info,
                        prefix: reference,
                        accepts: isEntity,
                        required: true,
                    });
                }

                continue;
            }

            const keyed = KEY_NAME.exec(info.name);

            if (keyed?.[1] !== undefined && keyed[2] !== undefined) {
                const keyField = singularize(keyed[2].replace("_", "").toLowerCase());
                const accepts = (candidate: Candidate): boolean =>
                    hasProperty(candidate, keyField) &&
                    !candidate.tags.has("notEntity") &&
                    !isProjection(candidate.declaration);
                const target = resolveName(keyed[1], accepts);

                if (target === null) {
                    unlinked.push({ owner, info, prefix: keyed[1], accepts, required: false });
                } else {
                    promote(target, keyField);
                    addRelation(owner, info, target, keyField, "name", false);
                }
            }
        }
    };

    for (let candidate = queue.shift(); candidate !== undefined; candidate = queue.shift()) {
        if (!processed.has(candidate)) {
            processed.add(candidate);
            connect(candidate);
        }
    }

    unlinked = unlinked.filter(
        ({ owner, info, prefix, required }) => !required || !linkByName(owner, info, prefix),
    );

    for (const candidate of embeddedBy.keys()) {
        if (
            candidate.identity === "auto" &&
            !referenced.has(candidate) &&
            ownerCount(embeddedBy, candidate) >= SHARED_VALUE_OWNERS
        ) {
            candidate.identity = "plain";
        }
    }

    for (const { first, file, line } of duplicates) {
        if (processed.has(first)) {
            issues.push({
                level: "warning",
                message: `Two types are named ${first.name} (${first.file} and ${file}); the ERD draws the first.`,
                entity: first.name,
                field: null,
                file,
                line,
            });
        }
    }

    for (const { owner, info, prefix, accepts, required } of unlinked) {
        const suggested = suggestName(prefix, accepts);

        if (suggested === null && !required) {
            continue;
        }

        const field = `${owner.name}.${info.name}`;

        issues.push({
            level: "warning",
            message:
                suggested === null
                    ? `${field} looks like a reference, but no entity matches "${prefix}". Tag it /** @ref Entity */, /** @external System */ for an id outside the mock, or /** @ref none */ for an id with no single target.`
                    : `${field} may point at ${suggested.name}, but only part of the name matches, so no line is drawn. Confirm with /** @ref ${suggested.name} */, or tag the real target, /** @external System */ or /** @ref none */.`,
            entity: owner.name,
            field: info.name,
            file: info.file,
            line: info.line,
        });
    }

    const entities = [...processed]
        .map(
            (candidate): ErdEntity => ({
                name: candidate.name,
                kind: isEntity(candidate) ? "entity" : "value",
                shared:
                    !isEntity(candidate) &&
                    ownerCount(embeddedBy, candidate) >= SHARED_VALUE_OWNERS,
                file: candidate.file,
                line: candidate.line,
                description: candidate.description,
                pk: isEntity(candidate) ? candidate.pk : null,
                fields: fieldsOf(candidate).map((info) => ({
                    name: info.name,
                    type: info.type,
                    optional: info.optional,
                    nullable: info.nullable,
                    array: info.array,
                    pk: isEntity(candidate) && info.name === candidate.pk,
                    refs: info.refs,
                    external: info.external,
                    description: info.description,
                })),
            }),
        )
        .sort((left, right) => left.name.localeCompare(right.name));

    if (entities.length === 0) {
        issues.push({
            level: "warning",
            message:
                "No entity types found. An entity is an exported type with an `id` field, or one tagged /** @entity */.",
            entity: null,
            field: null,
            file: null,
            line: null,
        });
    }

    return {
        files: files.map((file) => toPosix(relative(root, file))),
        entities,
        relations: relations.sort((left, right) => left.id.localeCompare(right.id)),
        issues: issues.sort(compareIssues),
    };
};
