export type ErdEntityKind = "entity" | "value";

export type ErdField = {
    name: string;
    type: string;
    optional: boolean;
    nullable: boolean;
    array: boolean;
    pk: boolean;
    refs: string[];
    external: string | null;
    description: string | null;
};

/**
 * A type the diagram draws as a box.
 *
 * `value` marks a type with no identity of its own that only exists nested inside another record
 * (an address, a bedroom spec, a provenance stamp). `shared` marks a value nested in so many types
 * that drawing a line from each would bury the real relationships, so the diagrams omit them.
 */
export type ErdEntity = {
    name: string;
    kind: ErdEntityKind;
    shared: boolean;
    file: string;
    line: number;
    description: string | null;
    pk: string | null;
    fields: ErdField[];
};

export type ErdRelationKind = "reference" | "embedded";

export type ErdRelationSource = "tag" | "name" | "type";

/**
 * One field pointing at another box. `from` always owns the field, whichever way the data flows.
 */
export type ErdRelation = {
    id: string;
    kind: ErdRelationKind;
    from: string;
    field: string;
    to: string;
    toField: string | null;
    many: boolean;
    optional: boolean;
    source: ErdRelationSource;
    polymorphic: boolean;
};

export type ErdIssueLevel = "error" | "warning";

export type ErdIssue = {
    level: ErdIssueLevel;
    message: string;
    entity: string | null;
    field: string | null;
    file: string | null;
    line: number | null;
};

export type ErdModel = {
    project: string;
    include: string[];
    files: string[];
    entities: ErdEntity[];
    relations: ErdRelation[];
    issues: ErdIssue[];
    mermaid: string;
    hash: string;
};
