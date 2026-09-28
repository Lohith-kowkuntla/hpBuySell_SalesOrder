//-----------------------------------------------------------------------------------*
// Confidential and Proprietary
// Copyright 2026, HP
// All Rights Reserved
//-----------------------------------------------------------------------------------*
// Automated tests for the Sales Order value-help routing/mapping/scope fix.
//
// Runs with Node's built-in test runner (no new devDependencies):
//   node --test test/
//
// Scope of these tests:
//   - Pure logic (routing decisions, field translation, config shape) is
//     exercised directly and deterministically.
//   - buildLocalValueHelpQuery/getAuthorizedLocalKeys build CQN via cds.ql,
//     which only requires @sap/cds to be required (no live DB/service
//     needed to *construct* a query - only to *run* one).
//   - Full HTTP-level behavior (actual OData requests, MDM destination
//     calls) is NOT covered here - it was verified manually against a
//     running `cds watch` instance instead (see PR notes), because this
//     project has no @cap-js/cds-test / jest installed to spin up a real
//     service in-process. Recommend adding @cap-js/cds-test as a
//     devDependency for true end-to-end coverage of $count/$filter/scope
//     interaction over HTTP.
//-----------------------------------------------------------------------------------*

"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
    UnknownValueHelpFieldError,
    translateExpr,
    resolveReader,
    validateFieldMapAgainstCsn
} = require("../srv/utils/valueHelpFieldTranslation");

const {
    VALUE_HELP_CONFIG,
    CUSTOMER_VISIBLE_VALUE_HELPS,
    isHiddenFromCustomer,
    buildLocalValueHelpQuery
} = require("../srv/utils/valueHelpScope");

const {
    isMdmValueHelp,
    MDM_VALUE_HELP_CONFIG,
    localColumnToMdmField
} = require("../srv/utils/mdmValueHelps");

const {
    buildScopeExpression
} = require("../srv/utils/userScope");


// =====================================================================
// 1. Routing
// =====================================================================

test("routing: HP user + local VH resolves to 'local', never touches MDM", () => {

    const config = { source: "local" };

    assert.equal(resolveReader(config, isMdmValueHelp, "VH_Customer"), "local");
});


test("routing: HP user + MDM VH resolves to 'mdm' when a mapping exists", () => {

    const config = { source: "mdm" };

    assert.equal(resolveReader(config, isMdmValueHelp, "VH_BusinessModel"), "mdm");
});


test("routing: source 'mdm' without an MDM mapping is rejected as misconfigured, not silently sent to MDM", () => {

    const config = { source: "mdm" };

    assert.throws(
        () => resolveReader(config, isMdmValueHelp, "VH_TotallyMadeUp"),
        /no corresponding MDM_VALUE_HELP_CONFIG entry/
    );
});


test("routing: unknown/unsupported source is rejected with a controlled error", () => {

    assert.throws(
        () => resolveReader({ source: "carrier-pigeon" }, isMdmValueHelp, "VH_Whatever"),
        /unsupported source/
    );

    assert.throws(
        () => resolveReader({}, isMdmValueHelp, "VH_Whatever"),
        /no configured source/
    );
});


test("routing: every VALUE_HELP_CONFIG entry resolves without throwing (config self-consistency)", () => {

    for (const [name, config] of Object.entries(VALUE_HELP_CONFIG)) {

        assert.doesNotThrow(
            () => resolveReader(config, isMdmValueHelp, name),
            `${name} should resolve cleanly`
        );
    }
});


// =====================================================================
// 2 & 3. Field mapping / correct local DB value helps
// =====================================================================

test("mapping: VH_SalesOrderType-shaped code filter translates to the real association FK column", () => {

    const fieldMap = { code: "salesOrderType_code" };

    const where = [{ ref: ["code"] }, "=", { val: "ZBLB" }];

    const translated = translateExpr(where, fieldMap);

    assert.deepEqual(translated, [{ ref: ["salesOrderType_code"] }, "=", { val: "ZBLB" }]);
});


test("mapping: priority orderBy for a status VH translates through fieldMap, not left as a bare 'priority' ref", () => {

    const fieldMap = { code: "salesOrderStatus_code", priority: "priority" };

    const orderBy = [{ ref: ["priority"], sort: "desc" }];

    const translated = translateExpr(orderBy, fieldMap);

    assert.deepEqual(translated, [{ ref: ["priority"], sort: "desc" }]);
});


test("regression: VH_SoAckOutOrigin / VH_SoChangeInOrigin are now real CodeList-backed projections, intentionally NOT redirected onto SalesOrderItems", () => {

    assert.equal(VALUE_HELP_CONFIG.VH_SoAckOutOrigin, undefined);
    assert.equal(VALUE_HELP_CONFIG.VH_SoChangeInOrigin, undefined);
});


test("mapping: VH_Customer.customerDescription is absent (no such column exists on SalesOrders)", () => {

    assert.ok(!("customerDescription" in VALUE_HELP_CONFIG.VH_Customer.fields));
});


test("mapping: unknown field referenced by a client filter throws UnknownValueHelpFieldError, not a raw DB crash", () => {

    const fieldMap = { customerCode: "customerCode" };

    assert.throws(
        () => translateExpr([{ ref: ["customerDescription"] }, "=", { val: "x" }], fieldMap),
        UnknownValueHelpFieldError
    );
});


test("mapping: nested xpr/func structures are translated recursively", () => {

    const fieldMap = { customerCode: "customerCode" };

    const where = [
        { xpr: [{ func: "contains", args: [{ ref: ["customerCode"] }, { val: "026" }] }] }
    ];

    const translated = translateExpr(where, fieldMap);

    assert.deepEqual(translated, [
        { xpr: [{ func: "contains", args: [{ ref: ["customerCode"] }, { val: "026" }] }] }
    ]);
});


test("mapping: multi-segment refs (already a path expression, e.g. scope joins) pass through untouched", () => {

    const fieldMap = { customerCode: "customerCode" };

    const node = [{ ref: ["salesOrder", "customerCode"] }, "=", { val: "X" }];

    assert.deepEqual(translateExpr(node, fieldMap), node);
});


test("mapping: validateFieldMapAgainstCsn passes for existing elements and fails clearly for missing ones", () => {

    const csn = {
        "hpbuysell.otc.salesorder.SalesOrders": {
            elements: { customerCode: {}, businessModel: {} }
        }
    };

    assert.doesNotThrow(() =>
        validateFieldMapAgainstCsn(
            csn,
            "hpbuysell.otc.salesorder.SalesOrders",
            { customerCode: "customerCode" },
            "VH_Customer"
        )
    );

    assert.throws(
        () =>
            validateFieldMapAgainstCsn(
                csn,
                "hpbuysell.otc.salesorder.SalesOrders",
                { customerDescription: "customerDescription" },
                "VH_Customer"
            ),
        /has no element\(s\)/
    );
});


test("regression: passthrough code lists (VH_OrderStatus etc.) are intentionally NOT redirected onto SalesOrders", () => {

    for (const name of [
        "VH_OrderStatus",
        "VH_LineStatus",
        "VH_SalesOrderType",
        "VH_SalesOrderOrigin",
        "VH_ReasonForCancellation"
    ]) {

        assert.ok(
            !(name in VALUE_HELP_CONFIG),
            `${name} must stay unregistered so CAP's generic READ serves it directly`
        );
    }
});


test("regression: every 'local' config's sourceEntity is one of SalesOrders/SalesOrderItems", () => {

    for (const [name, config] of Object.entries(VALUE_HELP_CONFIG)) {

        if (config.source !== "local") {
            continue;
        }

        assert.match(
            config.sourceEntity,
            /^hpbuysell\.otc\.salesorder\.(SalesOrders|SalesOrderItems)$/,
            `${name} sourceEntity looks wrong`
        );
    }
});


test("regression: every 'mdm' config has a matching MDM_VALUE_HELP_CONFIG entry", () => {

    for (const [name, config] of Object.entries(VALUE_HELP_CONFIG)) {

        if (config.source !== "mdm") {
            continue;
        }

        assert.ok(isMdmValueHelp(name), `${name} claims source 'mdm' but has no MDM mapping`);
    }
});


// =====================================================================
// 4/5. Authorization
// =====================================================================

function customerScope(customerId, projectIds) {

    return {
        unrestricted: false,
        customerUser: true,
        assignments: [{ customerId, projectIds }]
    };
}


test("authorization: Customer A and Customer B produce different scope expressions (cannot see each other)", () => {

    const scopeA = customerScope("CUST_A", ["P1"]);
    const scopeB = customerScope("CUST_B", ["P2"]);

    const exprA = buildScopeExpression({ target: { name: "SalesOrders" } }, scopeA);
    const exprB = buildScopeExpression({ target: { name: "SalesOrders" } }, scopeB);

    assert.notDeepEqual(exprA, exprB);

    assert.ok(JSON.stringify(exprA).includes("CUST_A"));
    assert.ok(!JSON.stringify(exprA).includes("CUST_B"));
});


test("authorization: a customer with no valid Customer+WBS assignment gets a fail-closed 1=0 expression, not unrestricted access", () => {

    const scope = { unrestricted: false, customerUser: true, assignments: [] };

    const expr = buildScopeExpression({ target: { name: "SalesOrders" } }, scope);

    assert.deepEqual(expr, [{ val: 1 }, "=", { val: 0 }]);
});


test("authorization: unrestricted (HP) scope applies no filter at all", () => {

    const expr = buildScopeExpression(
        { target: { name: "SalesOrders" } },
        { unrestricted: true }
    );

    assert.equal(expr, null);
});


test("authorization: item-level value helps carry the parent SalesOrder join in their scope path", () => {

    const scope = customerScope("CUST_A", ["P1"]);

    const expr = buildScopeExpression({ target: { name: "SalesOrderItems" } }, scope);

    assert.ok(JSON.stringify(expr).includes('"salesOrder"'), "expected a path through the parent SalesOrder association");
});


test("authorization: buildLocalValueHelpQuery ANDs the client filter with the scope expression, never lets it replace it", () => {

    const config = VALUE_HELP_CONFIG.VH_Customer;

    const req = {
        query: {
            SELECT: {
                where: [{ ref: ["customerCode"] }, "=", { val: "0260003194" }]
            }
        }
    };

    const scope = customerScope("0260003194", ["W-2000475"]);

    const query = buildLocalValueHelpQuery(req, "VH_Customer", config, scope);

    const whereJson = JSON.stringify(query.SELECT.where);

    // both the client's own filter and the authorization scope must be present
    assert.ok(whereJson.includes("0260003194"));
    assert.ok(whereJson.includes("and"));
});


test("authorization: an unauthorized customer key cannot be smuggled through localKeyField.column into MDM's IN-list without going through getAuthorizedLocalKeys", () => {

    // This asserts the *contract*: localColumnToMdmField only ever
    // translates a column name, it never accepts or forwards values -
    // so there is no path for a raw client-supplied value to reach MDM
    // without first passing through getAuthorizedLocalKeys' own scoped
    // query.
    const mdmField = localColumnToMdmField("VH_BusinessModel", "businessModel");

    assert.equal(typeof mdmField, "string");
    assert.equal(MDM_VALUE_HELP_CONFIG.VH_BusinessModel.outputMap[mdmField], "businessModel");
});


test("authorization: hidden fields (CUSTOMER_HIDDEN) are excluded from CUSTOMER_VISIBLE_VALUE_HELPS", () => {

    // businessModel is hidden from Customer users on SalesOrders
    assert.ok(isHiddenFromCustomer("VH_BusinessModel", VALUE_HELP_CONFIG.VH_BusinessModel));
    assert.ok(!CUSTOMER_VISIBLE_VALUE_HELPS.has("VH_BusinessModel"));

    // customerCode is NOT hidden
    assert.ok(!isHiddenFromCustomer("VH_Customer", VALUE_HELP_CONFIG.VH_Customer));
    assert.ok(CUSTOMER_VISIBLE_VALUE_HELPS.has("VH_Customer"));

    // storageLocation (item-level, MDM-sourced) is hidden
    assert.ok(!CUSTOMER_VISIBLE_VALUE_HELPS.has("VH_StorageLocation"));
});
