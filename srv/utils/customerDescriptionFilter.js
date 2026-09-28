//-----------------------------------------------------------------------------------*
// Confidential and Proprietary
// Copyright 2026, HP
// All Rights Reserved
//-----------------------------------------------------------------------------------*
// Sales Order Search - "Customer Description" filter support.
//
// customerDescription is virtual on SalesOrderSearchExport (there is no local
// column for it - it only ever exists in MDM). It can be *displayed* by
// resolveDescriptions() after a read, but it cannot be pushed into the local
// SQLite/Postgres WHERE clause. A client $filter on it has to be rewritten,
// before the local query runs, into "customerCode in (<codes matching that
// description in MDM>)" - using the already-built (but previously unwired)
// resolveCodesByText() text search.
//
// Two passes, because resolveCodesByText() is async and the CQN tree can't be
// walked-and-replaced in one synchronous pass:
//   1. collect every {customerDescription <op> "term"} node's operator/term
//   2. resolve each distinct (operator, term) pair to a set of customerCode
//      values, then substitute each node with a customerCode "in" (or the
//      fail-closed 1=0 sentinel, if the description matched nothing)
//-----------------------------------------------------------------------------------*

"use strict";

const TARGET_FIELD = "customerDescription";
const REPLACEMENT_FIELD = "customerCode";

const NO_MATCH = [{ val: 1 }, "=", { val: 0 }];

const FUNC_TO_OPERATOR = {
    contains: "contains",
    startswith: "startswith",
    endswith: "endswith"
};


function isCustomerDescriptionRef(node) {
    return !!node && Array.isArray(node.ref) && node.ref.length === 1 && node.ref[0] === TARGET_FIELD;
}


/**
 * Recursively finds every (operator, term) pair filtering on
 * customerDescription, deduplicated.
 *
 * @param {*} node
 * @param {Map<string, {operator:string, term:string}>} found keyed by "operator|term"
 */
function collectTerms(node, found) {

    if (Array.isArray(node)) {

        // eq/ne triples: [{ref:["customerDescription"]}, "=", {val:"..."}]
        if (
            node.length === 3 &&
            isCustomerDescriptionRef(node[0]) &&
            (node[1] === "=" || node[1] === "eq") &&
            node[2] && typeof node[2].val === "string"
        ) {

            const term = node[2].val;
            found.set("equals|" + term, { operator: "equals", term });
            return;
        }

        node.forEach((part) => collectTerms(part, found));
        return;
    }

    if (node && typeof node === "object") {

        if (
            typeof node.func === "string" &&
            FUNC_TO_OPERATOR[node.func] &&
            Array.isArray(node.args) &&
            node.args.length === 2 &&
            isCustomerDescriptionRef(node.args[0]) &&
            typeof node.args[1].val === "string"
        ) {

            const operator = FUNC_TO_OPERATOR[node.func];
            const term = node.args[1].val;
            found.set(operator + "|" + term, { operator, term });
            return;
        }

        if (Array.isArray(node.xpr)) {
            collectTerms(node.xpr, found);
        }

        if (Array.isArray(node.args)) {
            collectTerms(node.args, found);
        }
    }
}


function conditionForCodes(codes) {

    if (!codes.length) {
        return NO_MATCH;
    }

    return [
        { ref: [REPLACEMENT_FIELD] },
        "in",
        { list: codes.map((code) => ({ val: code })) }
    ];
}


/**
 * Replaces every customerDescription filter node with its resolved
 * customerCode condition. Same shape traversal as collectTerms, kept in
 * sync deliberately (a substitute pass mirrors a collect pass).
 *
 * @param {*} node
 * @param {Map<string, string[]>} resolved keyed by "operator|term" -> codes
 */
function substitute(node, resolved) {

    if (Array.isArray(node)) {

        if (
            node.length === 3 &&
            isCustomerDescriptionRef(node[0]) &&
            (node[1] === "=" || node[1] === "eq") &&
            node[2] && typeof node[2].val === "string"
        ) {

            const codes = resolved.get("equals|" + node[2].val) || [];
            return conditionForCodes(codes);
        }

        // A matched element (e.g. the sole {func:"contains",...} element of
        // a length-1 where-array) is replaced by a 3-token condition array.
        // That has to be SPLICED into this flat CQN array, not nested as a
        // single array-valued element - a raw where-array only ever holds
        // strings/objects, never a sub-array, so flatMap here is always
        // correct, never a mistaken flattening of real structure.
        return node.flatMap((part) => {

            const replaced = substitute(part, resolved);

            return Array.isArray(replaced) ? replaced : [replaced];
        });
    }

    if (node && typeof node === "object") {

        if (
            typeof node.func === "string" &&
            FUNC_TO_OPERATOR[node.func] &&
            Array.isArray(node.args) &&
            node.args.length === 2 &&
            isCustomerDescriptionRef(node.args[0]) &&
            typeof node.args[1].val === "string"
        ) {

            const operator = FUNC_TO_OPERATOR[node.func];
            const codes = resolved.get(operator + "|" + node.args[1].val) || [];
            return conditionForCodes(codes);
        }

        if (Array.isArray(node.xpr)) {
            return { ...node, xpr: substitute(node.xpr, resolved) };
        }

        if (Array.isArray(node.args)) {
            return { ...node, args: substitute(node.args, resolved) };
        }

        return node;
    }

    return node;
}


/**
 * Rewrites a CQN where-array so every customerDescription filter becomes a
 * customerCode "in" (authorized-by-MDM-lookup) condition. Returns the
 * original array unchanged (same reference) if it contains no
 * customerDescription reference at all - so callers can cheaply check
 * `result === where` to know whether anything changed.
 *
 * @param {Array} where CQN where array (req.query.SELECT.where)
 * @param {(sourceName: string, operator: string, term: string) => Promise<{codes:string[]}|null>} resolveCodesByText
 * @returns {Promise<Array>}
 */
async function translateCustomerDescriptionWhere(where, resolveCodesByText) {

    if (!Array.isArray(where) || !where.length) {
        return where;
    }

    const terms = new Map();

    collectTerms(where, terms);

    if (!terms.size) {
        return where;
    }

    const resolved = new Map();

    for (const [key, { operator, term }] of terms) {

        const answer = await resolveCodesByText("CUSTOMER", operator, term);

        resolved.set(key, (answer && answer.codes) || []);
    }

    return substitute(where, resolved);
}


module.exports = {
    TARGET_FIELD,
    translateCustomerDescriptionWhere,

    // exported for tests only
    collectTerms,
    substitute,
    conditionForCodes
};
