import type { ErdEntity, ErdField, ErdIssue, ErdModel, ErdRelation } from "../model.js";

type Payload = {
    model: ErdModel;
    live: boolean;
    modelUrl: string | null;
    eventsUrl: string | null;
};

type Point = {
    x: number;
    y: number;
};

type Bounds = Point & {
    width: number;
    height: number;
};

type Row = {
    field: ErdField;
    offset: number;
};

type Box = Bounds & {
    entity: ErdEntity;
    rows: Row[];
    hiddenFields: number;
    node: SVGGElement | null;
    rowNodes: Map<string, SVGGElement>;
};

type Side = 1 | -1;

type MarkerKind = "one" | "zeroOrOne" | "many";

type Geometry = {
    path: string;
    start: Point;
    end: Point;
    startSide: Side;
    endSide: Side;
};

type EdgeView = {
    relation: ErdRelation;
    group: SVGGElement;
    line: SVGPathElement;
    hit: SVGPathElement;
    startMarker: SVGGElement;
    endMarker: SVGGElement;
};

type Viewport = Point & {
    scale: number;
};

type Placement = {
    positions: Map<string, Point>;
    width: number;
    height: number;
};

type Track = {
    names: string[];
    column: number;
    x: number;
    width: number;
};

type Changes = {
    added: string[];
    changed: string[];
    removed: string[];
};

type State = {
    model: ErdModel;
    boxes: Map<string, Box>;
    edges: EdgeView[];
    manual: Map<string, Point>;
    session: Map<string, Point>;
    viewport: Viewport;
    selected: string | null;
    search: string;
    keysOnly: boolean;
    showValues: boolean;
};

type RenderOptions = {
    keepPositions: boolean;
};

type ElementOptions = {
    className?: string;
    text?: string;
    title?: string;
};

type Attributes = Record<string, string | number>;

type TextAnchor = "start" | "middle" | "end";

type Block = {
    total: number;
    count: number;
};

const SVG_NS = "http://www.w3.org/2000/svg";
const FONT_UI = `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
const FONT_MONO = `ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace`;
const FONT_TITLE = `600 13px ${FONT_UI}`;
const FONT_NOTE = `11px ${FONT_UI}`;
const FONT_FIELD = `12.5px ${FONT_UI}`;
const FONT_TYPE = `11.5px ${FONT_MONO}`;
const HEADER = 34;
const ROW = 22;
const FOOTER = 6;
const PAD = 12;
const BADGE_WIDTH = 26;
const NAME_X = PAD + BADGE_WIDTH + 8;
const NAME_GAP = 14;
const MIN_WIDTH = 200;
const MAX_WIDTH = 380;
const COLUMN_GAP = 150;
const TRACK_GAP = 72;
const STACK_GAP = 36;
const MIN_TRACK_HEIGHT = 1100;
const LARGE_MODEL = 24;
const COMPONENT_GAP = 140;
const MIN_SPAN = 36;
const MIN_SCALE = 0.1;
const MAX_SCALE = 2.5;

const find = <T extends Element>(id: string, type: { new (): T; prototype: T }): T => {
    const element = document.getElementById(id);

    if (!(element instanceof type)) {
        throw new Error(`ERD viewer markup is missing #${id}`);
    }

    return element;
};

const payload: Payload = JSON.parse(document.getElementById("erd-data")?.textContent ?? "{}");

const diagram = find("diagram", SVGSVGElement);
const viewportLayer = find("viewport", SVGGElement);
const edgesLayer = find("edges", SVGGElement);
const nodesLayer = find("nodes", SVGGElement);
const gridPattern = find("grid", SVGPatternElement);
const searchInput = find("search", HTMLInputElement);
const keysOnlyInput = find("keys-only", HTMLInputElement);
const showValuesInput = find("show-values", HTMLInputElement);
const zoomLevel = find("zoom-level", HTMLButtonElement);
const detailsPanel = find("details", HTMLElement);
const entityList = find("entity-list", HTMLUListElement);
const issueList = find("issue-list", HTMLUListElement);
const issuesSection = find("issues", HTMLElement);
const emptyState = find("empty", HTMLDivElement);
const toastElement = find("toast", HTMLDivElement);
const statusElement = find("status", HTMLDivElement);
const statusLabel = find("status-label", HTMLSpanElement);
const mermaidDialog = find("mermaid-dialog", HTMLDialogElement);
const mermaidText = find("mermaid-text", HTMLTextAreaElement);

const storageKey = (name: string): string => `erd:${payload.model.project}:${name}`;

const loadStored = (name: string): string | null => {
    try {
        return localStorage.getItem(storageKey(name));
    } catch {
        return null;
    }
};

const store = (name: string, value: string): void => {
    try {
        localStorage.setItem(storageKey(name), value);
    } catch {
        return;
    }
};

const loadPositions = (): Map<string, Point> => {
    const stored = loadStored("positions");

    if (stored === null) {
        return new Map();
    }

    try {
        const parsed: Record<string, Point> = JSON.parse(stored);

        return new Map(Object.entries(parsed));
    } catch {
        return new Map();
    }
};

const initialKeysOnly = (): boolean => {
    const stored = loadStored("keysOnly");

    if (stored === null) {
        return payload.model.entities.length > LARGE_MODEL;
    }

    return stored === "true";
};

const state: State = {
    model: payload.model,
    boxes: new Map(),
    edges: [],
    manual: loadPositions(),
    session: new Map(),
    viewport: { x: 0, y: 0, scale: 1 },
    selected: null,
    search: "",
    keysOnly: initialKeysOnly(),
    showValues: loadStored("showValues") !== "false",
};

const clamp = (value: number, min: number, max: number): number =>
    Math.min(max, Math.max(min, value));

const mean = (values: number[]): number =>
    values.reduce((total, value) => total + value, 0) / values.length;

const measurer = document.createElement("canvas").getContext("2d");
const measured = new Map<string, number>();

const textWidth = (text: string, font: string): number => {
    const key = `${font}|${text}`;
    const cached = measured.get(key);

    if (cached !== undefined) {
        return cached;
    }

    let width = text.length * 7;

    if (measurer !== null) {
        measurer.font = font;
        width = measurer.measureText(text).width;
    }

    measured.set(key, width);

    return width;
};

const truncate = (text: string, font: string, maxWidth: number): string => {
    if (textWidth(text, font) <= maxWidth) {
        return text;
    }

    let low = 0;
    let high = text.length;

    while (low < high) {
        const middle = Math.ceil((low + high) / 2);

        if (textWidth(`${text.slice(0, middle)}…`, font) <= maxWidth) {
            low = middle;
        } else {
            high = middle - 1;
        }
    }

    return `${text.slice(0, low)}…`;
};

const svgElement = <K extends keyof SVGElementTagNameMap>(
    tag: K,
    attributes: Attributes,
    parent: Element,
): SVGElementTagNameMap[K] => {
    const element = document.createElementNS(SVG_NS, tag);

    for (const [name, value] of Object.entries(attributes)) {
        element.setAttribute(name, String(value));
    }

    parent.appendChild(element);

    return element;
};

const svgText = (
    parent: Element,
    className: string,
    point: Point,
    content: string,
    anchor: TextAnchor = "start",
): SVGTextElement => {
    const element = svgElement(
        "text",
        { class: className, x: point.x, y: point.y, "text-anchor": anchor },
        parent,
    );

    element.textContent = content;

    return element;
};

const htmlElement = <K extends keyof HTMLElementTagNameMap>(
    tag: K,
    options: ElementOptions = {},
    children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] => {
    const element = document.createElement(tag);

    if (options.className !== undefined) {
        element.className = options.className;
    }

    if (options.text !== undefined) {
        element.textContent = options.text;
    }

    if (options.title !== undefined) {
        element.title = options.title;
    }

    element.append(...children);

    return element;
};

const entityNamed = (name: string): ErdEntity | undefined =>
    state.model.entities.find((entity) => entity.name === name);

const isShown = (entity: ErdEntity): boolean => entity.kind === "entity" || state.showValues;

const isSharedTarget = (relation: ErdRelation): boolean =>
    entityNamed(relation.to)?.shared === true;

const ownersOf = (name: string): number =>
    new Set(
        state.model.relations
            .filter((relation) => relation.to === name)
            .map((relation) => relation.from),
    ).size;

const noteOf = (entity: ErdEntity): string => {
    if (entity.shared) {
        return `shared by ${ownersOf(entity.name)}`;
    }

    return entity.kind === "value" ? "embedded" : "";
};

const fieldLabel = (field: ErdField): string => `${field.name}${field.optional ? "?" : ""}`;

const badgeOf = (field: ErdField): string | null => {
    if (field.pk) {
        return "pk";
    }

    if (field.refs.length > 0) {
        return "fk";
    }

    return field.external === null ? null : "ext";
};

const fieldNotes = (field: ErdField): string[] => {
    const notes: string[] = [];

    if (field.refs.length > 0) {
        notes.push(`References ${field.refs.join(" or ")}`);
    }

    if (field.external !== null) {
        notes.push(`Id in ${field.external}`);
    }

    if (field.nullable) {
        notes.push("Nullable");
    }

    if (field.description !== null) {
        notes.push(field.description);
    }

    return notes;
};

const cardinalityOf = (relation: ErdRelation): string => {
    if (relation.many) {
        return "many";
    }

    return relation.optional ? "optional" : "one";
};

const describeRelation = (relation: ErdRelation): string => {
    const target = relation.toField === null ? relation.to : `${relation.to}.${relation.toField}`;
    const origin = `${relation.from}.${relation.field}`;
    const polymorphic = relation.polymorphic ? " It is one of several possible targets." : "";

    if (relation.kind === "embedded" && relation.many) {
        return `${origin} nests a list of ${relation.to} inside each ${relation.from}.`;
    }

    if (relation.kind === "embedded") {
        const amount = relation.optional ? "an optional" : "one";

        return `${origin} nests ${amount} ${relation.to} inside each ${relation.from}.`;
    }

    if (relation.many) {
        return `${origin} → ${target}: each ${relation.from} holds a list of ${relation.to} ids (many to many).${polymorphic}`;
    }

    const amount = relation.optional ? "at most one" : "exactly one";

    return `${origin} → ${target}: each ${relation.from} points at ${amount} ${relation.to}.${polymorphic}`;
};

const buildBox = (entity: ErdEntity, linkedFields: Set<string>): Box => {
    const fields = state.keysOnly
        ? entity.fields.filter(
              (field) => field.pk || field.refs.length > 0 || linkedFields.has(field.name),
          )
        : entity.fields;
    const content = fields.reduce(
        (widest, field) =>
            Math.max(
                widest,
                NAME_X +
                    textWidth(fieldLabel(field), FONT_FIELD) +
                    NAME_GAP +
                    textWidth(field.type, FONT_TYPE),
            ),
        0,
    );
    const titleWidth =
        textWidth(entity.name, FONT_TITLE) + textWidth(noteOf(entity), FONT_NOTE) + 40;
    const hiddenFields = entity.fields.length - fields.length;

    return {
        entity,
        x: 0,
        y: 0,
        width: Math.round(clamp(Math.max(content, titleWidth) + PAD, MIN_WIDTH, MAX_WIDTH)),
        height: HEADER + (fields.length + (hiddenFields > 0 ? 1 : 0)) * ROW + FOOTER,
        rows: fields.map((field, index) => ({ field, offset: HEADER + index * ROW + ROW / 2 })),
        hiddenFields,
        node: null,
        rowNodes: new Map(),
    };
};

const placeColumn = (desired: number[], heights: number[]): number[] => {
    const offsets: number[] = [];
    let offset = 0;

    for (const height of heights) {
        offsets.push(offset);
        offset += height + STACK_GAP;
    }

    const blocks: Block[] = [];

    desired.forEach((value, index) => {
        blocks.push({ total: value - (offsets[index] ?? 0), count: 1 });

        while (blocks.length > 1) {
            const last = blocks[blocks.length - 1];
            const previous = blocks[blocks.length - 2];

            if (
                last === undefined ||
                previous === undefined ||
                previous.total / previous.count <= last.total / last.count
            ) {
                break;
            }

            previous.total += last.total;
            previous.count += last.count;
            blocks.pop();
        }
    });

    const placed: number[] = [];

    for (const block of blocks) {
        for (let index = 0; index < block.count; index += 1) {
            placed.push(block.total / block.count + (offsets[placed.length] ?? 0));
        }
    }

    return placed;
};

const layoutComponent = (
    members: string[],
    boxes: Map<string, Box>,
    parents: Map<string, Set<string>>,
    children: Map<string, Set<string>>,
    neighbors: Map<string, Set<string>>,
): Placement => {
    const sizeOf = (name: string): Box | undefined => boxes.get(name);
    const back = new Set<string>();
    const active = new Set<string>();
    const done = new Set<string>();

    const visit = (name: string): void => {
        active.add(name);

        for (const child of [...(children.get(name) ?? [])].sort()) {
            if (active.has(child)) {
                back.add(`${name}>${child}`);
            } else if (!done.has(child)) {
                visit(child);
            }
        }

        active.delete(name);
        done.add(name);
    };

    const roots = members.filter((name) => (parents.get(name)?.size ?? 0) === 0);

    for (const name of [...roots, ...members]) {
        if (!done.has(name)) {
            visit(name);
        }
    }

    const childrenOf = (name: string): string[] =>
        [...(children.get(name) ?? [])].filter((child) => !back.has(`${name}>${child}`));
    const indegree = new Map(
        members.map((name) => [
            name,
            [...(parents.get(name) ?? [])].filter((parent) => !back.has(`${parent}>${name}`))
                .length,
        ]),
    );
    const order: string[] = [];
    const ready = members.filter((name) => indegree.get(name) === 0);

    for (let name = ready.shift(); name !== undefined; name = ready.shift()) {
        order.push(name);

        for (const child of childrenOf(name)) {
            const remaining = (indegree.get(child) ?? 1) - 1;

            indegree.set(child, remaining);

            if (remaining === 0) {
                ready.push(child);
            }
        }
    }

    const rank = new Map(members.map((name) => [name, 0]));

    for (const name of order) {
        for (const child of childrenOf(name)) {
            rank.set(child, Math.max(rank.get(child) ?? 0, (rank.get(name) ?? 0) + 1));
        }
    }

    for (const name of [...order].reverse()) {
        const childRanks = childrenOf(name).map((child) => rank.get(child) ?? 0);

        if (childRanks.length > 0) {
            rank.set(name, Math.max(rank.get(name) ?? 0, Math.min(...childRanks) - 1));
        }
    }

    const columnCount = Math.max(...members.map((name) => rank.get(name) ?? 0)) + 1;
    const columns: string[][] = Array.from({ length: columnCount }, () => []);

    for (const name of order) {
        columns[rank.get(name) ?? 0]?.push(name);
    }

    const position = new Map<string, number>();
    const reindex = (column: string[]): void => {
        for (const [index, name] of column.entries()) {
            position.set(name, index);
        }
    };

    columns.forEach(reindex);

    for (let sweep = 0; sweep < 8; sweep += 1) {
        const forward = sweep % 2 === 0;

        for (let step = 1; step < columnCount; step += 1) {
            const index = forward ? step : columnCount - 1 - step;
            const adjacent = forward ? index - 1 : index + 1;
            const column = columns[index] ?? [];
            const keys = new Map(
                column.map((name) => {
                    const linked = [...(neighbors.get(name) ?? [])].filter(
                        (neighbor) => rank.get(neighbor) === adjacent,
                    );

                    return [
                        name,
                        linked.length === 0
                            ? (position.get(name) ?? 0)
                            : mean(linked.map((neighbor) => position.get(neighbor) ?? 0)),
                    ];
                }),
            );

            column.sort((left, right) => (keys.get(left) ?? 0) - (keys.get(right) ?? 0));
            reindex(column);
        }
    }

    const heightOf = (name: string): number => sizeOf(name)?.height ?? HEADER;
    const widthOf = (name: string): number => sizeOf(name)?.width ?? MIN_WIDTH;
    const stackHeight = (names: string[]): number =>
        names.reduce((total, name) => total + heightOf(name) + STACK_GAP, 0);
    const area = members.reduce(
        (total, name) => total + (heightOf(name) + STACK_GAP) * (widthOf(name) + TRACK_GAP),
        0,
    );
    const trackLimit = Math.max(MIN_TRACK_HEIGHT, Math.sqrt(area) * 0.9);
    const tracks: Track[] = [];

    columns.forEach((column, columnIndex) => {
        const count = clamp(Math.ceil(stackHeight(column) / trackLimit), 1, column.length);

        for (let offset = 0; offset < count; offset += 1) {
            const names = column.filter((_name, index) => index % count === offset);

            tracks.push({
                names,
                column: columnIndex,
                x: 0,
                width: Math.max(...names.map(widthOf)),
            });
        }
    });

    tracks.forEach((track, index) => {
        const previous = tracks[index - 1];

        if (previous !== undefined) {
            track.x =
                previous.x +
                previous.width +
                (previous.column === track.column ? TRACK_GAP : COLUMN_GAP);
        }
    });

    const top = new Map<string, number>();

    const place = (track: Track, desired: number[]): void => {
        for (const [index, value] of placeColumn(desired, track.names.map(heightOf)).entries()) {
            top.set(track.names[index] ?? "", value);
        }
    };

    for (const track of tracks) {
        place(
            track,
            track.names.map(() => 0),
        );
    }

    for (let iteration = 0; iteration < 8; iteration += 1) {
        const sequence = iteration % 2 === 0 ? tracks : [...tracks].reverse();

        for (const track of sequence) {
            place(
                track,
                track.names.map((name) => {
                    const linked = [...(neighbors.get(name) ?? [])];

                    if (linked.length === 0) {
                        return top.get(name) ?? 0;
                    }

                    const centers = linked.map(
                        (neighbor) => (top.get(neighbor) ?? 0) + heightOf(neighbor) / 2,
                    );

                    return mean(centers) - heightOf(name) / 2;
                }),
            );
        }
    }

    const minTop = Math.min(...members.map((name) => top.get(name) ?? 0));
    const positions = new Map<string, Point>();
    let height = 0;

    for (const track of tracks) {
        for (const name of track.names) {
            const y = Math.round((top.get(name) ?? 0) - minTop);

            positions.set(name, { x: Math.round(track.x + (track.width - widthOf(name)) / 2), y });
            height = Math.max(height, y + heightOf(name));
        }
    }

    const last = tracks[tracks.length - 1];

    return { positions, width: last === undefined ? 0 : last.x + last.width, height };
};

const layout = (boxes: Box[], relations: ErdRelation[]): Map<string, Point> => {
    const byName = new Map(boxes.map((box) => [box.entity.name, box]));
    const parents = new Map<string, Set<string>>();
    const children = new Map<string, Set<string>>();
    const neighbors = new Map<string, Set<string>>();

    for (const name of byName.keys()) {
        parents.set(name, new Set());
        children.set(name, new Set());
        neighbors.set(name, new Set());
    }

    for (const relation of relations) {
        const parent = relation.kind === "reference" ? relation.to : relation.from;
        const child = relation.kind === "reference" ? relation.from : relation.to;

        if (parent !== child && byName.has(parent) && byName.has(child)) {
            parents.get(child)?.add(parent);
            children.get(parent)?.add(child);
            neighbors.get(parent)?.add(child);
            neighbors.get(child)?.add(parent);
        }
    }

    const seen = new Set<string>();
    const components: string[][] = [];

    for (const name of byName.keys()) {
        if (seen.has(name)) {
            continue;
        }

        const component: string[] = [];
        const pending = [name];

        seen.add(name);

        for (let next = pending.shift(); next !== undefined; next = pending.shift()) {
            component.push(next);

            for (const neighbor of neighbors.get(next) ?? []) {
                if (!seen.has(neighbor)) {
                    seen.add(neighbor);
                    pending.push(neighbor);
                }
            }
        }

        components.push(component.sort());
    }

    components.sort((left, right) => right.length - left.length);

    const placements = components.map((component) =>
        layoutComponent(component, byName, parents, children, neighbors),
    );
    const area = placements.reduce(
        (total, placement) =>
            total + (placement.width + COMPONENT_GAP) * (placement.height + COMPONENT_GAP),
        0,
    );
    const wrapWidth = Math.max(1800, Math.sqrt(area) * 1.6);
    const positions = new Map<string, Point>();
    let x = 0;
    let y = 0;
    let rowHeight = 0;

    for (const placement of placements) {
        if (x > 0 && x + placement.width > wrapWidth) {
            x = 0;
            y += rowHeight + COMPONENT_GAP;
            rowHeight = 0;
        }

        for (const [name, point] of placement.positions) {
            positions.set(name, { x: point.x + x, y: point.y + y });
        }

        x += placement.width + COMPONENT_GAP;
        rowHeight = Math.max(rowHeight, placement.height);
    }

    return positions;
};

const overlaps = (first: Bounds, second: Bounds, margin: number): boolean =>
    first.x < second.x + second.width + margin &&
    second.x < first.x + first.width + margin &&
    first.y < second.y + second.height + margin &&
    second.y < first.y + first.height + margin;

const resolveOverlaps = (boxes: Box[], pinned: Set<string>): void => {
    for (let pass = 0; pass < 40; pass += 1) {
        let moved = false;
        const ordered = [...boxes].sort((left, right) => left.y - right.y);

        for (const [index, upper] of ordered.entries()) {
            for (const lower of ordered.slice(index + 1)) {
                if (!overlaps(upper, lower, 20)) {
                    continue;
                }

                const lowerPinned = pinned.has(lower.entity.name);

                if (lowerPinned && pinned.has(upper.entity.name)) {
                    continue;
                }

                const [mover, anchor] = lowerPinned ? [upper, lower] : [lower, upper];

                mover.y = anchor.y + anchor.height + 28;
                moved = true;
            }
        }

        if (!moved) {
            return;
        }
    }
};

const translate = (point: Point): string => `translate(${point.x} ${point.y})`;

const headerPath = (width: number): string =>
    `M0 ${HEADER} V8 A8 8 0 0 1 8 0 H${width - 8} A8 8 0 0 1 ${width} 8 V${HEADER} Z`;

const rowOffset = (box: Box, fieldName: string | null): number =>
    box.rows.find((row) => row.field.name === fieldName)?.offset ?? HEADER / 2;

const edgeGeometry = (relation: ErdRelation): Geometry | null => {
    const from = state.boxes.get(relation.from);
    const to = state.boxes.get(relation.to);

    if (from === undefined || to === undefined) {
        return null;
    }

    const startY = from.y + rowOffset(from, relation.field);
    const targetY = to.y + rowOffset(to, relation.kind === "reference" ? relation.toField : null);

    if (from === to) {
        const x = from.x + from.width;
        const endY = targetY === startY ? startY + ROW : targetY;
        const bulge = x + 64;

        return {
            path: `M ${x} ${startY} C ${bulge} ${startY} ${bulge} ${endY} ${x} ${endY}`,
            start: { x, y: startY },
            end: { x, y: endY },
            startSide: 1,
            endSide: 1,
        };
    }

    let startSide: Side = 1;
    let endSide: Side = 1;

    if (from.x + from.width + MIN_SPAN <= to.x) {
        endSide = -1;
    } else if (to.x + to.width + MIN_SPAN <= from.x) {
        startSide = -1;
    }

    const startX = startSide === 1 ? from.x + from.width : from.x;
    const endX = endSide === 1 ? to.x + to.width : to.x;
    let startControl = Math.max(startX, endX) + 64;
    let endControl = startControl;

    if (startSide !== endSide) {
        const reach = Math.max(56, Math.abs(endX - startX) * 0.5);

        startControl = startX + startSide * reach;
        endControl = endX + endSide * reach;
    }

    return {
        path: `M ${startX} ${startY} C ${startControl} ${startY} ${endControl} ${targetY} ${endX} ${targetY}`,
        start: { x: startX, y: startY },
        end: { x: endX, y: targetY },
        startSide,
        endSide,
    };
};

const markerKinds = (relation: ErdRelation): [MarkerKind, MarkerKind] => {
    const single: MarkerKind = relation.optional ? "zeroOrOne" : "one";

    if (relation.kind === "embedded") {
        return ["one", relation.many ? "many" : single];
    }

    return ["many", relation.many ? "many" : single];
};

const drawMarker = (group: SVGGElement, kind: MarkerKind, point: Point, side: Side): void => {
    const along = (distance: number): number => point.x + side * distance;
    const bar = (distance: number): string =>
        `M ${along(distance)} ${point.y - 6} V ${point.y + 6}`;

    group.replaceChildren();

    switch (kind) {
        case "one":
            svgElement("path", { d: `${bar(8)} ${bar(13)}` }, group);
            break;
        case "zeroOrOne":
            svgElement("path", { d: bar(8) }, group);
            svgElement(
                "circle",
                { class: "marker-circle", cx: along(18), cy: point.y, r: 4 },
                group,
            );
            break;
        case "many": {
            const toe = along(13);

            svgElement(
                "path",
                {
                    d: `M ${toe} ${point.y} L ${point.x} ${point.y - 7} M ${toe} ${point.y} L ${point.x} ${point.y} M ${toe} ${point.y} L ${point.x} ${point.y + 7}`,
                },
                group,
            );
            svgElement(
                "circle",
                { class: "marker-circle", cx: along(19), cy: point.y, r: 4 },
                group,
            );
            break;
        }
    }
};

const updateEdge = (view: EdgeView): void => {
    const geometry = edgeGeometry(view.relation);

    if (geometry === null) {
        return;
    }

    const [startKind, endKind] = markerKinds(view.relation);

    view.line.setAttribute("d", geometry.path);
    view.hit.setAttribute("d", geometry.path);
    drawMarker(view.startMarker, startKind, geometry.start, geometry.startSide);
    drawMarker(view.endMarker, endKind, geometry.end, geometry.endSide);
};

const linkRows = (relation: ErdRelation, className: string, linked: boolean): void => {
    state.boxes
        .get(relation.from)
        ?.rowNodes.get(relation.field)
        ?.classList.toggle(className, linked);

    if (relation.toField !== null) {
        state.boxes
            .get(relation.to)
            ?.rowNodes.get(relation.toField)
            ?.classList.toggle(className, linked);
    }
};

const hoverEdge = (view: EdgeView, hovered: boolean): void => {
    view.group.classList.toggle("is-hovered", hovered);
    linkRows(view.relation, "is-hover-linked", hovered);
};

const hoverField = (entity: string, field: string, hovered: boolean): void => {
    for (const view of state.edges) {
        const { relation } = view;

        if (
            (relation.from === entity && relation.field === field) ||
            (relation.to === entity && relation.toField === field)
        ) {
            hoverEdge(view, hovered);
        }
    }
};

const toDiagram = (event: PointerEvent): Point => {
    const rect = diagram.getBoundingClientRect();

    return {
        x: (event.clientX - rect.left - state.viewport.x) / state.viewport.scale,
        y: (event.clientY - rect.top - state.viewport.y) / state.viewport.scale,
    };
};

const applyViewport = (): void => {
    const { x, y, scale } = state.viewport;
    const transform = `translate(${x} ${y}) scale(${scale})`;

    viewportLayer.setAttribute("transform", transform);
    gridPattern.setAttribute("patternTransform", transform);
    zoomLevel.textContent = `${Math.round(scale * 100)}%`;
};

const zoomAt = (clientX: number, clientY: number, factor: number): void => {
    const rect = diagram.getBoundingClientRect();
    const anchor = { x: clientX - rect.left, y: clientY - rect.top };
    const scale = clamp(state.viewport.scale * factor, MIN_SCALE, MAX_SCALE);
    const ratio = scale / state.viewport.scale;

    state.viewport = {
        scale,
        x: anchor.x - (anchor.x - state.viewport.x) * ratio,
        y: anchor.y - (anchor.y - state.viewport.y) * ratio,
    };
    applyViewport();
};

const zoomBy = (factor: number): void => {
    const rect = diagram.getBoundingClientRect();

    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, factor);
};

const contentBounds = (): Bounds | null => {
    const boxes = [...state.boxes.values()];

    if (boxes.length === 0) {
        return null;
    }

    const left = Math.min(...boxes.map((box) => box.x));
    const top = Math.min(...boxes.map((box) => box.y));
    const right = Math.max(...boxes.map((box) => box.x + box.width));
    const bottom = Math.max(...boxes.map((box) => box.y + box.height));

    return { x: left, y: top, width: right - left, height: bottom - top };
};

const fit = (): void => {
    const bounds = contentBounds();
    const rect = diagram.getBoundingClientRect();

    if (bounds === null || rect.width === 0 || rect.height === 0) {
        return;
    }

    const margin = 48;
    const scale = clamp(
        Math.min(
            (rect.width - margin * 2) / bounds.width,
            (rect.height - margin * 2) / bounds.height,
        ),
        MIN_SCALE,
        1.1,
    );

    state.viewport = {
        scale,
        x: (rect.width - bounds.width * scale) / 2 - bounds.x * scale,
        y: (rect.height - bounds.height * scale) / 2 - bounds.y * scale,
    };
    applyViewport();
};

const focusEntity = (name: string): void => {
    const entity = entityNamed(name);

    if (entity !== undefined && !isShown(entity)) {
        setShowValues(true);
    }

    const box = state.boxes.get(name);
    const rect = diagram.getBoundingClientRect();

    if (box === undefined) {
        return;
    }

    const scale = Math.max(state.viewport.scale, 0.75);
    const tall = box.height * scale > rect.height - 120;

    state.viewport = {
        scale,
        x: rect.width / 2 - (box.x + box.width / 2) * scale,
        y: tall ? 60 - box.y * scale : rect.height / 2 - (box.y + box.height / 2) * scale,
    };
    applyViewport();
    select(name);
};

const select = (name: string | null): void => {
    state.selected = name;
    applyHighlights();
    renderEntityList();
    renderDetails();
};

const startDrag = (box: Box, event: PointerEvent): void => {
    if (event.button !== 0) {
        return;
    }

    event.stopPropagation();

    const name = box.entity.name;
    const origin = toDiagram(event);
    const start: Point = { x: box.x, y: box.y };
    const connected = state.edges.filter(
        (view) => view.relation.from === name || view.relation.to === name,
    );
    let dragging = false;

    const move = (moveEvent: PointerEvent): void => {
        const point = toDiagram(moveEvent);
        const dx = point.x - origin.x;
        const dy = point.y - origin.y;

        if (!dragging && Math.hypot(dx, dy) * state.viewport.scale < 4) {
            return;
        }

        dragging = true;
        box.node?.classList.add("is-dragging");
        box.x = Math.round(start.x + dx);
        box.y = Math.round(start.y + dy);
        box.node?.setAttribute("transform", translate(box));

        for (const view of connected) {
            updateEdge(view);
        }
    };

    const finish = (): void => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", finish);
        window.removeEventListener("pointercancel", finish);
        box.node?.classList.remove("is-dragging");

        if (!dragging) {
            select(state.selected === name ? null : name);

            return;
        }

        state.manual.set(name, { x: box.x, y: box.y });
        state.session.delete(name);
        store("positions", JSON.stringify(Object.fromEntries(state.manual)));
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
};

const drawRow = (box: Box, row: Row, group: SVGGElement): void => {
    const { field } = row;
    const rowGroup = svgElement(
        "g",
        { class: "field", transform: `translate(0 ${row.offset - ROW / 2})` },
        group,
    );
    const badge = badgeOf(field);
    const available = box.width - PAD - NAME_X;
    const typeWidth = textWidth(field.type, FONT_TYPE);
    const label = truncate(
        fieldLabel(field),
        FONT_FIELD,
        Math.max(available * 0.6, available - typeWidth - NAME_GAP),
    );
    const typeSpace = available - textWidth(label, FONT_FIELD) - NAME_GAP;

    svgElement("rect", { class: "field-bg", x: 1, width: box.width - 2, height: ROW }, rowGroup);

    if (badge !== null) {
        svgElement(
            "rect",
            {
                class: `badge-box ${badge}`,
                x: PAD,
                y: ROW / 2 - 7,
                width: BADGE_WIDTH,
                height: 14,
                rx: 3,
            },
            rowGroup,
        );
        svgText(
            rowGroup,
            `badge-text ${badge}`,
            { x: PAD + BADGE_WIDTH / 2, y: ROW / 2 + 3 },
            badge.toUpperCase(),
            "middle",
        );
    }

    svgText(
        rowGroup,
        field.optional ? "field-name optional" : "field-name",
        { x: NAME_X, y: ROW / 2 + 4.5 },
        label,
    );

    if (typeSpace > 24) {
        svgText(
            rowGroup,
            "field-type",
            { x: box.width - PAD, y: ROW / 2 + 4 },
            truncate(field.type, FONT_TYPE, typeSpace),
            "end",
        );
    }

    svgElement("title", {}, rowGroup).textContent = [
        `${fieldLabel(field)}: ${field.type}`,
        ...fieldNotes(field),
    ].join("\n");
    rowGroup.addEventListener("pointerenter", () => hoverField(box.entity.name, field.name, true));
    rowGroup.addEventListener("pointerleave", () => hoverField(box.entity.name, field.name, false));
    box.rowNodes.set(field.name, rowGroup);
};

const drawBox = (box: Box): void => {
    const { entity } = box;
    const group = svgElement(
        "g",
        { class: `entity ${entity.kind}`, transform: translate(box), "data-entity": entity.name },
        nodesLayer,
    );
    const note = noteOf(entity);
    const noteWidth = note === "" ? 0 : textWidth(note, FONT_NOTE) + 10;

    svgElement(
        "rect",
        { class: "entity-body", width: box.width, height: box.height, rx: 8 },
        group,
    );

    const heading = svgElement("g", { class: "entity-heading" }, group);

    svgElement("path", { class: "entity-header", d: headerPath(box.width) }, heading);
    svgText(
        heading,
        "entity-title",
        { x: PAD, y: HEADER / 2 + 4.5 },
        truncate(entity.name, FONT_TITLE, box.width - PAD * 2 - noteWidth),
    );

    if (note !== "") {
        svgText(heading, "entity-note", { x: box.width - PAD, y: HEADER / 2 + 4 }, note, "end");
    }

    svgElement("title", {}, heading).textContent = [
        entity.name,
        `${entity.file}:${entity.line}`,
        entity.description ?? "",
    ]
        .filter((line) => line !== "")
        .join("\n");

    for (const row of box.rows) {
        drawRow(box, row, group);
    }

    if (box.hiddenFields > 0) {
        svgText(
            group,
            "field-more",
            { x: NAME_X, y: HEADER + box.rows.length * ROW + ROW / 2 + 4 },
            `+ ${box.hiddenFields} more ${box.hiddenFields === 1 ? "field" : "fields"}`,
        );
    }

    group.addEventListener("pointerdown", (event) => startDrag(box, event));
    box.node = group;
};

const drawEdge = (relation: ErdRelation): EdgeView => {
    const classes = ["edge", relation.kind, relation.polymorphic ? "polymorphic" : ""];
    const group = svgElement("g", { class: classes.join(" ").trim() }, edgesLayer);
    const view: EdgeView = {
        relation,
        group,
        hit: svgElement("path", { class: "edge-hit" }, group),
        line: svgElement("path", { class: "edge-line" }, group),
        startMarker: svgElement("g", { class: "edge-marker" }, group),
        endMarker: svgElement("g", { class: "edge-marker" }, group),
    };

    svgElement("title", {}, group).textContent = describeRelation(relation);
    group.addEventListener("pointerenter", () => hoverEdge(view, true));
    group.addEventListener("pointerleave", () => hoverEdge(view, false));

    return view;
};

const applyHighlights = (): void => {
    const { selected } = state;
    const query = state.search.trim().toLowerCase();
    const related = new Set<string>();
    const touching =
        selected === null
            ? []
            : state.model.relations.filter(
                  (relation) => relation.from === selected || relation.to === selected,
              );

    if (selected !== null) {
        related.add(selected);
    }

    for (const relation of touching) {
        related.add(relation.from);
        related.add(relation.to);
    }

    for (const box of state.boxes.values()) {
        const name = box.entity.name;
        let matched = query !== "" && name.toLowerCase().includes(query);

        for (const [field, node] of box.rowNodes) {
            const hit = query !== "" && field.toLowerCase().includes(query);

            node.classList.toggle("is-match", hit);
            node.classList.remove("is-linked");
            matched = matched || hit;
        }

        box.node?.classList.toggle("is-match", matched);
        box.node?.classList.toggle("is-related", related.has(name));
        box.node?.classList.toggle("is-selected", name === selected);
    }

    for (const relation of touching) {
        linkRows(relation, "is-linked", true);
    }

    for (const view of state.edges) {
        view.group.classList.toggle("is-related", touching.includes(view.relation));
    }

    diagram.classList.toggle("has-selection", selected !== null);
    diagram.classList.toggle("has-search", query !== "");
};

const matchesSearch = (entity: ErdEntity): boolean => {
    const query = state.search.trim().toLowerCase();

    return (
        query === "" ||
        entity.name.toLowerCase().includes(query) ||
        entity.fields.some((field) => field.name.toLowerCase().includes(query))
    );
};

const renderEntityList = (): void => {
    const shown = state.model.entities.filter((entity) => isShown(entity) && matchesSearch(entity));

    find("entity-count", HTMLSpanElement).textContent = String(shown.length);
    entityList.replaceChildren(
        ...shown.map((entity) => {
            const button = htmlElement("button", { title: `${entity.file}:${entity.line}` }, [
                htmlElement("span", { className: "name", text: entity.name }),
                ...(entity.kind === "value"
                    ? [
                          htmlElement("span", {
                              className: "kind",
                              text: entity.shared ? "shared" : "embedded",
                          }),
                      ]
                    : []),
                htmlElement("span", { className: "meta", text: String(entity.fields.length) }),
            ]);

            button.type = "button";
            button.setAttribute("aria-current", String(entity.name === state.selected));
            button.addEventListener("click", () => focusEntity(entity.name));

            return htmlElement("li", {}, [button]);
        }),
    );
};

const focusIssue = (issue: ErdIssue): void => {
    if (issue.entity === null) {
        return;
    }

    focusEntity(issue.entity);

    const row =
        issue.field === null ? undefined : state.boxes.get(issue.entity)?.rowNodes.get(issue.field);

    row?.classList.add("is-match");
    setTimeout(() => row?.classList.remove("is-match"), 2500);
};

const renderIssues = (): void => {
    const { issues } = state.model;

    issuesSection.hidden = issues.length === 0;
    find("issue-count", HTMLSpanElement).textContent = String(issues.length);
    issueList.replaceChildren(
        ...issues.map((issue) => {
            const where = issue.file === null ? "" : `${issue.file}:${issue.line ?? 1}`;
            const button = htmlElement("button", { className: issue.level }, [
                issue.message,
                ...(where === "" ? [] : [htmlElement("span", { className: "where", text: where })]),
            ]);

            button.type = "button";
            button.addEventListener("click", () => focusIssue(issue));

            return htmlElement("li", {}, [button]);
        }),
    );
};

const relationLinks = (
    title: string,
    relations: ErdRelation[],
    describe: (relation: ErdRelation) => [string, string, string],
): HTMLElement[] => {
    if (relations.length === 0) {
        return [];
    }

    return [
        htmlElement("h3", { text: title }),
        htmlElement(
            "ul",
            { className: "link-list" },
            relations.map((relation) => {
                const [label, target, aside] = describe(relation);
                const button = htmlElement("button", { text: label });

                button.type = "button";
                button.addEventListener("click", () => focusEntity(target));

                return htmlElement("li", {}, [
                    button,
                    htmlElement("span", { className: "aside", text: aside }),
                ]);
            }),
        ),
    ];
};

const renderDetails = (): void => {
    const entity = state.selected === null ? undefined : entityNamed(state.selected);

    if (entity === undefined) {
        detailsPanel.hidden = true;
        detailsPanel.replaceChildren();

        return;
    }

    const close = htmlElement("button", {
        className: "details-close",
        text: "×",
        title: "Close (Esc)",
    });
    const outgoing = state.model.relations.filter((relation) => relation.from === entity.name);
    const incoming = state.model.relations.filter((relation) => relation.to === entity.name);
    const cardinality = (relation: ErdRelation): string => ` (${cardinalityOf(relation)})`;

    close.type = "button";
    close.addEventListener("click", () => select(null));
    detailsPanel.hidden = false;
    detailsPanel.replaceChildren(
        htmlElement("div", { className: "details-header" }, [
            htmlElement("h2", { text: entity.name }),
            close,
        ]),
        htmlElement("div", {
            className: "where",
            text: `${entity.kind === "value" ? "Embedded type · " : ""}${entity.file}:${entity.line}`,
        }),
        ...(entity.description === null
            ? []
            : [htmlElement("p", { className: "description", text: entity.description })]),
        ...relationLinks(
            "References",
            outgoing.filter((relation) => relation.kind === "reference"),
            (relation) => [
                `${relation.field} → ${relation.to}`,
                relation.to,
                cardinality(relation),
            ],
        ),
        ...relationLinks(
            "Referenced by",
            incoming.filter((relation) => relation.kind === "reference"),
            (relation) => [
                `${relation.from}.${relation.field}`,
                relation.from,
                cardinality(relation),
            ],
        ),
        ...relationLinks(
            "Nests",
            outgoing.filter((relation) => relation.kind === "embedded"),
            (relation) => [
                `${relation.field} → ${relation.to}`,
                relation.to,
                cardinality(relation),
            ],
        ),
        ...relationLinks(
            "Nested in",
            incoming.filter((relation) => relation.kind === "embedded"),
            (relation) => [
                `${relation.from}.${relation.field}`,
                relation.from,
                cardinality(relation),
            ],
        ),
        htmlElement("h3", { text: `Fields (${entity.fields.length})` }),
        htmlElement(
            "table",
            { className: "field-table" },
            entity.fields.map((field) => {
                const badge = badgeOf(field);

                return htmlElement("tr", {}, [
                    htmlElement(
                        "td",
                        { className: "field-cell-badge" },
                        badge === null
                            ? []
                            : [
                                  htmlElement("span", {
                                      className: `badge ${badge}`,
                                      text: badge.toUpperCase(),
                                  }),
                              ],
                    ),
                    htmlElement("td", {}, [
                        fieldLabel(field),
                        htmlElement("span", { className: "type", text: field.type }),
                        ...fieldNotes(field).map((note) =>
                            htmlElement("span", { className: "notes", text: note }),
                        ),
                    ]),
                ]);
            }),
        ),
    );
};

const renderSummary = (): void => {
    const { model } = state;
    const entities = model.entities.filter((entity) => entity.kind === "entity").length;
    const values = model.entities.length - entities;
    const parts = [
        `${entities} ${entities === 1 ? "entity" : "entities"}`,
        `${model.relations.length} ${model.relations.length === 1 ? "relationship" : "relationships"}`,
    ];

    if (values > 0) {
        parts.push(`${values} embedded ${values === 1 ? "type" : "types"}`);
    }

    find("title", HTMLDivElement).textContent = model.project;
    find("stats", HTMLDivElement).textContent = parts.join(" · ");
    find("sources", HTMLElement).textContent = model.include.join(", ");
    document.title = `ERD · ${model.project}`;
};

const render = (options: RenderOptions): void => {
    const visible = state.model.entities.filter(isShown);
    const names = new Set(visible.map((entity) => entity.name));
    const relations = state.model.relations.filter(
        (relation) =>
            names.has(relation.from) && names.has(relation.to) && !isSharedTarget(relation),
    );
    const linked = new Map<string, Set<string>>();

    const link = (entity: string, field: string | null): void => {
        if (field !== null) {
            const fields = linked.get(entity) ?? new Set<string>();

            fields.add(field);
            linked.set(entity, fields);
        }
    };

    for (const relation of relations) {
        link(relation.from, relation.field);
        link(relation.to, relation.kind === "reference" ? relation.toField : null);
    }

    const boxes = visible.map((entity) => buildBox(entity, linked.get(entity.name) ?? new Set()));

    if (!options.keepPositions) {
        state.session.clear();
    }

    const automatic = layout(boxes, relations);

    for (const box of boxes) {
        const name = box.entity.name;
        const point = state.manual.get(name) ??
            state.session.get(name) ??
            automatic.get(name) ?? { x: 0, y: 0 };

        box.x = point.x;
        box.y = point.y;
    }

    resolveOverlaps(boxes, new Set(state.manual.keys()));

    for (const box of boxes) {
        if (!state.manual.has(box.entity.name)) {
            state.session.set(box.entity.name, { x: box.x, y: box.y });
        }
    }

    state.boxes = new Map(boxes.map((box) => [box.entity.name, box]));
    nodesLayer.replaceChildren();
    edgesLayer.replaceChildren();

    for (const box of boxes) {
        drawBox(box);
    }

    state.edges = relations.map(drawEdge);

    for (const view of state.edges) {
        updateEdge(view);
    }

    if (state.selected !== null && !state.boxes.has(state.selected)) {
        state.selected = null;
    }

    emptyState.hidden = boxes.length > 0;
    renderSummary();
    renderEntityList();
    renderIssues();
    renderDetails();
    applyHighlights();
};

const setShowValues = (show: boolean): void => {
    state.showValues = show;
    showValuesInput.checked = show;
    store("showValues", String(show));
    render({ keepPositions: false });
    fit();
};

const diffModels = (previous: ErdModel, next: ErdModel): Changes => {
    const before = new Map(
        previous.entities.map((entity) => [entity.name, JSON.stringify(entity)]),
    );
    const after = new Map(next.entities.map((entity) => [entity.name, JSON.stringify(entity)]));

    return {
        added: [...after.keys()].filter((name) => !before.has(name)),
        changed: [...after.keys()].filter(
            (name) => before.has(name) && before.get(name) !== after.get(name),
        ),
        removed: [...before.keys()].filter((name) => !after.has(name)),
    };
};

let toastTimer: ReturnType<typeof setTimeout> | undefined;

const toast = (message: string): void => {
    toastElement.textContent = message;
    toastElement.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toastElement.hidden = true;
    }, 3500);
};

const flash = (names: string[], className: string): void => {
    for (const name of names) {
        const node = state.boxes.get(name)?.node;

        node?.classList.add(className);
        setTimeout(() => node?.classList.remove(className), 5000);
    }
};

const applyModel = (next: ErdModel): void => {
    if (next.hash === state.model.hash) {
        return;
    }

    const changes = diffModels(state.model, next);
    const parts = [
        changes.added.length > 0 ? `added ${changes.added.join(", ")}` : "",
        changes.changed.length > 0 ? `changed ${changes.changed.join(", ")}` : "",
        changes.removed.length > 0 ? `removed ${changes.removed.join(", ")}` : "",
    ].filter((part) => part !== "");

    state.model = next;
    render({ keepPositions: true });
    flash(changes.added, "is-new");
    flash(changes.changed, "is-changed");
    toast(parts.length === 0 ? "Model updated" : `Model updated: ${parts.join("; ")}`);
};

const setStatus = (status: string, label: string): void => {
    statusElement.dataset.state = status;
    statusLabel.textContent = label;
};

const connect = (url: string): void => {
    const source = new EventSource(url);

    setStatus("connecting", "Connecting");
    source.addEventListener("open", () => setStatus("live", "Live"));
    source.addEventListener("error", () => setStatus("offline", "Reconnecting"));
    source.addEventListener("model", (event) => {
        if (event instanceof MessageEvent && typeof event.data === "string") {
            applyModel(JSON.parse(event.data));
        }
    });
};

const slug = (text: string): string =>
    text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

const downloadSvg = (): void => {
    const bounds = contentBounds();
    const clone = diagram.cloneNode(true);

    if (bounds === null || !(clone instanceof SVGSVGElement)) {
        return;
    }

    const margin = 32;
    const width = bounds.width + margin * 2;
    const height = bounds.height + margin * 2;
    const style = document.createElementNS(SVG_NS, "style");
    const background = document.createElementNS(SVG_NS, "rect");

    style.textContent = document.getElementById("erd-style")?.textContent ?? "";
    background.setAttribute("class", "export-background");
    background.setAttribute("x", String(bounds.x - margin));
    background.setAttribute("y", String(bounds.y - margin));
    background.setAttribute("width", String(width));
    background.setAttribute("height", String(height));
    background.setAttribute("fill", "var(--canvas)");
    clone.removeAttribute("class");
    clone.removeAttribute("id");
    clone.setAttribute("width", String(width));
    clone.setAttribute("height", String(height));
    clone.setAttribute("viewBox", `${bounds.x - margin} ${bounds.y - margin} ${width} ${height}`);
    clone.querySelector("#backdrop")?.remove();
    clone.querySelector("#viewport")?.removeAttribute("transform");

    const transient = ["is-related", "is-match", "is-selected", "is-linked", "is-hover-linked"];

    for (const node of clone.querySelectorAll(transient.map((name) => `.${name}`).join(", "))) {
        node.classList.remove(...transient);
    }

    clone.prepend(style, background);

    const blob = new Blob([new XMLSerializer().serializeToString(clone)], {
        type: "image/svg+xml",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${slug(state.model.project)}-erd.svg`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const copyMermaid = async (): Promise<void> => {
    try {
        await navigator.clipboard.writeText(state.model.mermaid);
        toast("Mermaid source copied to the clipboard");
    } catch {
        mermaidText.value = state.model.mermaid;
        mermaidDialog.showModal();
        mermaidText.select();
    }
};

diagram.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) {
        return;
    }

    const start: Point = { x: event.clientX, y: event.clientY };
    const origin: Point = { x: state.viewport.x, y: state.viewport.y };
    const onEdge = event.target instanceof Element && event.target.closest(".edge") !== null;
    let panning = false;

    const move = (moveEvent: PointerEvent): void => {
        const dx = moveEvent.clientX - start.x;
        const dy = moveEvent.clientY - start.y;

        if (!panning && Math.hypot(dx, dy) < 4) {
            return;
        }

        panning = true;
        diagram.classList.add("is-panning");
        state.viewport = { ...state.viewport, x: origin.x + dx, y: origin.y + dy };
        applyViewport();
    };

    const finish = (): void => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", finish);
        window.removeEventListener("pointercancel", finish);
        diagram.classList.remove("is-panning");

        if (!panning && !onEdge) {
            select(null);
        }
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
});

diagram.addEventListener(
    "wheel",
    (event) => {
        event.preventDefault();

        if (event.ctrlKey || event.metaKey) {
            zoomAt(event.clientX, event.clientY, Math.exp(-event.deltaY * 0.01));

            return;
        }

        state.viewport = {
            ...state.viewport,
            x: state.viewport.x - event.deltaX,
            y: state.viewport.y - event.deltaY,
        };
        applyViewport();
    },
    { passive: false },
);

searchInput.addEventListener("input", () => {
    state.search = searchInput.value;
    applyHighlights();
    renderEntityList();
});

searchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        const first = state.model.entities.find(
            (entity) => isShown(entity) && matchesSearch(entity),
        );

        if (first !== undefined) {
            focusEntity(first.name);
        }
    }

    if (event.key === "Escape") {
        searchInput.value = "";
        state.search = "";
        applyHighlights();
        renderEntityList();
        searchInput.blur();
    }
});

keysOnlyInput.checked = state.keysOnly;
keysOnlyInput.addEventListener("change", () => {
    state.keysOnly = keysOnlyInput.checked;
    store("keysOnly", String(state.keysOnly));
    render({ keepPositions: false });
    fit();
});

showValuesInput.checked = state.showValues;
showValuesInput.addEventListener("change", () => setShowValues(showValuesInput.checked));

find("zoom-in", HTMLButtonElement).addEventListener("click", () => zoomBy(1.2));
find("zoom-out", HTMLButtonElement).addEventListener("click", () => zoomBy(1 / 1.2));
zoomLevel.addEventListener("click", () => zoomBy(1 / state.viewport.scale));
find("fit", HTMLButtonElement).addEventListener("click", fit);
find("download-svg", HTMLButtonElement).addEventListener("click", downloadSvg);
find("copy-mermaid", HTMLButtonElement).addEventListener("click", () => void copyMermaid());
find("reset-layout", HTMLButtonElement).addEventListener("click", () => {
    state.manual.clear();
    store("positions", "{}");
    render({ keepPositions: false });
    fit();
});

const isTyping = (target: EventTarget | null): boolean =>
    (target instanceof HTMLInputElement && target.type !== "checkbox") ||
    target instanceof HTMLTextAreaElement;

window.addEventListener("keydown", (event) => {
    if (isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) {
        return;
    }

    switch (event.key) {
        case "/":
            event.preventDefault();
            searchInput.focus();
            break;
        case "f":
            fit();
            break;
        case "+":
        case "=":
            zoomBy(1.2);
            break;
        case "-":
            zoomBy(1 / 1.2);
            break;
        case "0":
            zoomBy(1 / state.viewport.scale);
            break;
        case "Escape":
            select(null);
            break;
    }
});

render({ keepPositions: false });
applyViewport();
requestAnimationFrame(fit);

if (payload.live && payload.eventsUrl !== null) {
    connect(payload.eventsUrl);
} else {
    setStatus("static", "Snapshot");
}
