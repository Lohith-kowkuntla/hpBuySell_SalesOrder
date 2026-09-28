//-----------------------------------------------------------------------------------*
// Confidential and Proprietary
// Copyright 2026, HP
// All Rights Reserved
//-----------------------------------------------------------------------------------*
// Tests for the Customer Description search-filter translation
// (srv/utils/customerDescriptionFilter.js). Run with: node --test test/
//-----------------------------------------------------------------------------------*

"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
    translateCustomerDescriptionWhere,
    conditionForCodes
} = require("../srv/utils/customerDescriptionFilter");


function fakeResolver(map) {

    return async (sourceName, operator, term) => {

        assert.equal(sourceName, "CUSTOMER");

        const codes = map[operator + "|" + term];

        return codes ? { codes } : { codes: [] };
    };
}


test("leaves a where-array with no customerDescription reference untouched", async () => {

    const where = [{ ref: ["lineStatus"] }, "=", { val: "OPEN" }];

    const result = await translateCustomerDescriptionWhere(where, fakeResolver({}));

    assert.equal(result, where, "should return the exact same array reference when nothing to translate");
});


test("translates a sole contains(customerDescription,...) node into a flat customerCode IN (...) condition", async () => {

    const where = [
        { func: "contains", args: [{ ref: ["customerDescription"] }, { val: "Hon" }] }
    ];

    const result = await translateCustomerDescriptionWhere(
        where,
        fakeResolver({ "contains|Hon": ["0260003194"] })
    );

    // must be a FLAT 3-token CQN array, not [[...]] nested
    assert.deepEqual(result, [
        { ref: ["customerCode"] },
        "in",
        { list: [{ val: "0260003194" }] }
    ]);
});


test("no MDM match produces the fail-closed 1=0 sentinel, not an empty IN-list", async () => {

    const codes = [];

    assert.deepEqual(conditionForCodes(codes), [{ val: 1 }, "=", { val: 0 }]);
});


test("translates within a combined AND filter without corrupting the other condition", async () => {

    const where = [
        { func: "contains", args: [{ ref: ["customerDescription"] }, { val: "Hon" }] },
        "and",
        { ref: ["lineStatus"] }, "=", { val: "OPEN" }
    ];

    const result = await translateCustomerDescriptionWhere(
        where,
        fakeResolver({ "contains|Hon": ["0260003194"] })
    );

    assert.deepEqual(result, [
        { ref: ["customerCode"] },
        "in",
        { list: [{ val: "0260003194" }] },
        "and",
        { ref: ["lineStatus"] }, "=", { val: "OPEN" }
    ]);
});


test("supports eq/equals as well as contains", async () => {

    const where = [{ ref: ["customerDescription"] }, "=", { val: "Acme Corp" }];

    const result = await translateCustomerDescriptionWhere(
        where,
        fakeResolver({ "equals|Acme Corp": ["0260009999"] })
    );

    assert.deepEqual(result, [
        { ref: ["customerCode"] },
        "in",
        { list: [{ val: "0260009999" }] }
    ]);
});
