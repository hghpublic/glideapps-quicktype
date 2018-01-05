"use strict";

import { Set, List, OrderedSet } from "immutable";
import stringHash = require("string-hash");

import { TypeGraph } from "./TypeGraph";
import { Type } from "./Type";

export type DeclarationKind = "forward" | "define";

export class Declaration {
    constructor(readonly kind: DeclarationKind, readonly type: Type) {}

    equals(other: any): boolean {
        if (!(other instanceof Declaration)) return false;
        return this.kind === other.kind && this.type.equals(other.type);
    }

    hashCode(): number {
        return (stringHash(this.kind) + this.type.hashCode()) | 0;
    }
}

export class DeclarationIR {
    constructor(readonly declarations: List<Declaration>, readonly cycleBreakerTypes: Set<Type>) {}
}

export function declarationsForGraph(
    graph: TypeGraph,
    needsForwardDeclarations: boolean,
    childrenOfType: (t: Type) => OrderedSet<Type>,
    typeNeedsDeclaration: (t: Type) => boolean
): DeclarationIR {
    let definedTypes: Set<Type> = Set();
    let forwardedTypes: Set<Type> = Set();
    const declarations: Declaration[] = [];

    function visit(t: Type, path: Set<Type>): void {
        if (definedTypes.has(t)) return;

        if (path.has(t)) {
            if (needsForwardDeclarations) {
                declarations.push(new Declaration("forward", t));
                forwardedTypes = forwardedTypes.add(t);
            }
            return;
        }

        const pathForChildren = path.add(t);
        childrenOfType(t).forEach(c => visit(c, pathForChildren));

        if (definedTypes.has(t)) return;
        if (forwardedTypes.has(t) || typeNeedsDeclaration(t)) {
            declarations.push(new Declaration("define", t));
            definedTypes = definedTypes.add(t);
        }
    }

    let topLevels = graph.topLevels;
    if (needsForwardDeclarations) {
        topLevels = topLevels.reverse();
    }

    topLevels.forEach(t => visit(t, Set()));

    let declarationsList = List(declarations);
    if (!needsForwardDeclarations) {
        declarationsList = declarationsList.reverse();
    }

    return new DeclarationIR(declarationsList, forwardedTypes);
}
