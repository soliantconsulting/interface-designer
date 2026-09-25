import type { ErdEntity, ErdField, ErdIssue, ErdRelation } from "./model.js";

export type DiagramInput = {
    entities: ErdEntity[];
    relations: ErdRelation[];
};

export type MarkdownInput = {
    project: string;
    include: string[];
    path: string;
    mermaid: string;
    issues: ErdIssue[];
};

const IDENTIFIER = /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/;
const LITERAL = /^(["'`]).*\1$|^-?\d/;

const splitTopLevel = (text: string, separator: string): string[] => {
    const parts: string[] = [];
    let depth = 0;
    let quote: string | null = null;
    let current = "";
    let previous = "";

    for (const char of text) {
        if (quote !== null) {
            quote = char === quote ? null : quote;
        } else if (char === '"' || char === "'" || char === "`") {
            quote = char;
        } else if ("<([{".includes(char)) {
            depth += 1;
        } else if (")]}".includes(char) || (char === ">" && previous !== "=")) {
            depth -= 1;
        } else if (char === separator && depth === 0) {
            parts.push(current.trim());
            current = "";
            previous = char;
            continue;
        }

        current += char;
        previous = char;
    }

    parts.push(current.trim());

    return parts.filter((part) => part !== "");
};

const sanitize = (token: string): string => {
    const cleaned = token.replace(/[^\w\-()[\]]/g, "_");

    return /^[A-Za-z]/.test(cleaned) ? cleaned : `t${cleaned}`;
};

const withoutNull = (type: string): string[] =>
    splitTopLevel(type, "|").filter((member) => member !== "null" && member !== "undefined");

const typeToken = (type: string): string => {
    const members = withoutNull(type);
    const [only] = members;

    if (only === undefined) {
        return "null";
    }

    if (members.every((member) => LITERAL.test(member))) {
        return "enum";
    }

    if (members.length > 1) {
        return "union";
    }

    const bare = only.replace(/^readonly\s+/, "");
    const element =
        /^(.*)\[\]$/.exec(bare)?.[1] ?? /^(?:Readonly)?Array<(.*)>$/.exec(bare)?.[1] ?? null;

    if (element !== null) {
        return `${typeToken(element.replace(/^\((.*)\)$/, "$1"))}[]`;
    }

    if (IDENTIFIER.test(bare)) {
        return sanitize(bare.split(".").pop() ?? bare);
    }

    if (bare.startsWith("{")) {
        return "object";
    }

    const generic = /^([A-Za-z_$][\w$]*)</.exec(bare)?.[1];

    return generic === undefined ? "unknown" : sanitize(generic);
};

const commentFor = (field: ErdField, token: string): string => {
    const notes: string[] = [];
    const declared = withoutNull(field.type).join(" | ");

    if (field.refs.length > 0) {
        notes.push(`to ${field.refs.join(" or ")}`);
    }

    if (field.external !== null) {
        notes.push(`external ${field.external}`);
    }

    if (field.optional) {
        notes.push("optional");
    }

    if (field.nullable) {
        notes.push("nullable");
    }

    if (token !== sanitize(declared) && field.refs.length === 0) {
        notes.push(declared.length > 80 ? `${declared.slice(0, 77)}...` : declared);
    }

    return notes.length === 0 ? "" : ` "${notes.join(", ").replaceAll('"', "'")}"`;
};

const attributeLine = (field: ErdField): string => {
    const token = typeToken(field.type);
    const keys = [field.pk ? "PK" : null, field.refs.length > 0 ? "FK" : null].filter(
        (key) => key !== null,
    );
    const keyText = keys.length === 0 ? "" : ` ${keys.join(", ")}`;

    return `        ${token} ${sanitize(field.name)}${keyText}${commentFor(field, token)}`;
};

const embeddedMarker = (relation: ErdRelation): string => {
    if (relation.many) {
        return "o{";
    }

    return relation.optional ? "o|" : "||";
};

const relationLine = (relation: ErdRelation): string => {
    const label = `"${relation.field}"`;

    if (relation.kind === "embedded") {
        return `    ${relation.from} ||..${embeddedMarker(relation)} ${relation.to} : ${label}`;
    }

    if (relation.many) {
        return `    ${relation.from} }o--o{ ${relation.to} : ${label}`;
    }

    return `    ${relation.to} ${relation.optional ? "|o" : "||"}--o{ ${relation.from} : ${label}`;
};

/**
 * Renders a Mermaid `erDiagram`. References draw solid and embedded records dashed, matching the
 * live viewer rather than Mermaid's identifying/non-identifying reading of line style.
 */
export const renderMermaid = ({ entities, relations }: DiagramInput): string => {
    const lines = ["erDiagram"];
    const shared = new Set(entities.filter((entity) => entity.shared).map((entity) => entity.name));

    for (const entity of entities) {
        lines.push(`    ${entity.name} {`, ...entity.fields.map(attributeLine), "    }");
    }

    for (const relation of relations) {
        if (!shared.has(relation.to)) {
            lines.push(relationLine(relation));
        }
    }

    for (const name of shared) {
        const owners = new Set(
            relations.filter((relation) => relation.to === name).map((relation) => relation.from),
        );

        lines.push(`    %% ${name} is nested in ${owners.size} types; those lines are left out.`);
    }

    return lines.join("\n");
};

export const renderMarkdown = ({
    project,
    include,
    path,
    mermaid,
    issues,
}: MarkdownInput): string => {
    const sources = include.map((source) => `\`${source}\``).join(", ");
    const lines = [
        `# ${project} data model`,
        "",
        `Generated by the ERD plugin in \`erd/\` from ${sources}. Do not edit this file: change the entity types and it is rewritten on the next dev-server change or build. The live diagram is at \`${path}\` on the dev server.`,
        "",
        "Solid lines are references by id. Dashed lines are records nested inside their parent.",
        "",
        "```mermaid",
        mermaid,
        "```",
        "",
    ];

    if (issues.length > 0) {
        lines.push("## Warnings", "");

        for (const issue of issues) {
            const where = issue.file === null ? "" : `\`${issue.file}:${issue.line ?? 1}\` `;

            lines.push(`- ${where}${issue.message}`);
        }

        lines.push("");
    }

    return lines.join("\n");
};
