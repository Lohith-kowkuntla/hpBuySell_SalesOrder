//-----------------------------------------------------------------------------------*
// Confidential and Proprietary
// Copyright 2026, HP
// All Rights Reserved
//-----------------------------------------------------------------------------------*

const cds = require("@sap/cds");

const {
    loadUserScope,
    buildScopeExpression
} = require("./userScope");

const {
    isMdmValueHelp,
    readMdmValueHelp,
    MDM_VALUE_HELP_CONFIG
} = require("./mdmValueHelps");


// -----------------------------------------------------------------------------
// Customer-visible Value Helps
// -----------------------------------------------------------------------------
//
// These are the Value Helps that a Customer user is allowed to see.
//
// IMPORTANT:
//   - This list controls Customer visibility.
//   - It does NOT decide whether the source is LOCAL or MDM.
//   - HP users continue using the existing MDM routing.
// -----------------------------------------------------------------------------

const CUSTOMER_VISIBLE_VALUE_HELPS = new Set([
    "VH_SalesOrderNumber",
    "VH_Customer",
    "VH_CustomerName",
    "VH_CustomerOrder",
    "VH_CustomerPart",
    "VH_LineId",
    "VH_LineStatus",
    "VH_SalesOrderStatus",
    "VH_SalesOrderOrigin",
    "VH_SoAckOutOrigin",
    "VH_SoChangeInOrigin",
    "VH_WbsProject",
    "VH_Buyer",
    "VH_BuyerName",
    "VH_CompanyCode",
    "VH_SalesOrganization",
    "VH_BusinessModel",
    "VH_SpecialDealFlag",
    "VH_SalesOrderType",
    "VH_BillTo"
]);


// -----------------------------------------------------------------------------
// Local Value Help configuration
// -----------------------------------------------------------------------------
//
// sourceEntity = REAL service entity used for querying.
//
// We deliberately DO NOT query the VH projection directly.
//
// Example:
//
// VH_BusinessModel
//      exposed fields:
//          businessModel
//
// underlying source:
//      SalesOrders
//
// authorization fields:
//      customerCode
//      wbsProjectCode
//
// This avoids:
//
//   "customerCode not found in the elements of VH_BusinessModel"
// -----------------------------------------------------------------------------

const VALUE_HELP_CONFIG = {

    VH_Customer: {
        source: "local",
        entity: "hpbuysell.otc.salesorder.SalesOrders",
        columns: [
            "customerCode",
            "customerDescription"
        ],
        scope: true
    },

    VH_CustomerName: {
        source: "local",
        entity: "hpbuysell.otc.salesorder.SalesOrders",
        columns: [
            "customerCode",
            "customerDescription"
        ],
        scope: true
    },

    VH_SalesOrderNumber: {
        source: "local",
        entity: "hpbuysell.otc.salesorder.SalesOrders",
        columns: [
            "hpSalesOrder",
            "customerDescription"
        ],
        scope: true
    },

    VH_CustomerOrder: {
        source: "local",
        entity: "hpbuysell.otc.salesorder.SalesOrders",
        columns: [
            "customerOrder"
        ],
        scope: true
    },

    VH_CustomerPart: {
        source: "local",
        entity: "hpbuysell.otc.salesorder.SalesOrderItems",
        columns: [
            "customerPartNumber"
        ],
        scope: true
    },

    VH_SalesOrder: {
        source: "local",
        entity: "hpbuysell.otc.salesorder.SalesOrders",
        columns: [
            "hpSalesOrder"
        ],
        scope: true
    },

    VH_LineId: {
        source: "local",
        entity: "hpbuysell.otc.salesorder.SalesOrderItems",
        columns: [
            "lineId"
        ],
        scope: true
    },

    VH_OrderStatus: {
        source: "local",
        entity: "hpbuysell.otc.salesorder.SalesOrders",
        columns: [
            "salesOrderStatus_code"
        ],
        scope: true
    },

    VH_LineStatus: {
        source: "local",
        entity: "hpbuysell.otc.salesorder.SalesOrderItems",
        columns: [
            "lineStatus_code"
        ],
        scope: true
    },

    VH_SalesOrderOrigin: {
        source: "local",
        entity: "hpbuysell.otc.salesorder.SalesOrders",
        columns: [
            "salesOrderOrigin_code"
        ],
        scope: true
    },

    VH_SoAckOutOrigin: {
        source: "local",
        entity: "hpbuysell.otc.salesorder.SalesOrderItems",
        columns: [
            "soAckOutOrigin_code"
        ],
        scope: true
    },

    VH_SoChangeInOrigin: {
        source: "local",
        entity: "hpbuysell.otc.salesorder.SalesOrderItems",
        columns: [
            "soChangeInOrigin_code"
        ],
        scope: true
    },

    VH_SpecialDealFlag: {
        source: "local",
        entity: "hpbuysell.otc.salesorder.SalesOrders",
        columns: [
            "specialDealFlagSo"
        ],
        scope: true
    },

    VH_SalesOrderType: {
        source: "local",
        entity: "hpbuysell.otc.salesorder.SalesOrders",
        columns: [
            "salesOrderType_code"
        ],
        scope: true
    },

    VH_BillTo: {
        source: "local",
        entity: "hpbuysell.otc.salesorder.SalesOrders",
        columns: [
            "billTo",
            "billToDescription"
        ],
        scope: true
    },

    VH_Buyer: {
        source: "local",
        entity: "hpbuysell.otc.salesorder.SalesOrders",
        columns: [
            "hpBuyerCode",
            "hpBuyerName"
        ],
        scope: true
    },

    VH_BuyerName: {
        source: "local",
        entity: "hpbuysell.otc.salesorder.SalesOrders",
        columns: [
            "hpBuyerCode",
            "hpBuyerName"
        ],
        scope: true
    },

    VH_CompanyCode: {
        source: "local",
        entity: "hpbuysell.otc.salesorder.SalesOrders",
        columns: [
            "hpCompanyCode",
            "hpCompanyDescription"
        ],
        scope: true
    },

    VH_WbsProject: {
        source: "local",
        entity: "hpbuysell.otc.salesorder.SalesOrders",
        columns: [
            "wbsProjectCode",
            "wbsProjectCodeDescription"
        ],
        scope: true
    },

    VH_BusinessModel: {
        source: "local",
        entity: "hpbuysell.otc.salesorder.SalesOrders",
        columns: [
            "businessModel"
        ],
        scope: true
    },

    VH_HpPartNumber: {
        source: "local",
        entity: "hpbuysell.otc.salesorder.SalesOrderItems",
        columns: [
            "hpPartNumber",
            "hpPartDescription"
        ],
        scope: true
    }
};


// -----------------------------------------------------------------------------
// Utility: identify Value Help
// -----------------------------------------------------------------------------

function isConfiguredValueHelp(valueHelpName) {
    return Boolean(VALUE_HELP_CONFIG[valueHelpName]);
}


// -----------------------------------------------------------------------------
// Utility: make Value Help return no rows
// -----------------------------------------------------------------------------
function makeValueHelpEmpty(req) {

    if (!req.query?.SELECT) {
        return;
    }

    const select = req.query.SELECT;

    const emptyExpression = cds.parse.expr("1 = 0").xpr;

    if (select.where?.length) {

        select.where = [
            "(",
            ...select.where,
            ")",
            "and",
            ...emptyExpression
        ];

    } else {

        select.where = emptyExpression;
    }
}


// -----------------------------------------------------------------------------
// Utility: copy incoming OData query options
// -----------------------------------------------------------------------------
//
// The incoming query is based on the exposed VH.
//
// Example:
//
// VH_BusinessModel
//      $filter=contains(businessModel,'ABC')
//      $top=20
//
// These options are copied to the underlying SalesOrders query.
//
// Most VH field names intentionally match the underlying SalesOrders fields.
// -----------------------------------------------------------------------------

function copyQueryOptions(sourceSelect, targetSelect) {

    if (!sourceSelect || !targetSelect) {
        return;
    }

    // WHERE / $filter
    if (sourceSelect.where) {
        targetSelect.where = sourceSelect.where;
    }

    // $search
    if (sourceSelect.search) {
        targetSelect.search = sourceSelect.search;
    }

    // $orderby
    if (sourceSelect.orderBy) {
        targetSelect.orderBy = sourceSelect.orderBy;
    }

    // $top / $skip
    if (sourceSelect.limit) {
        targetSelect.limit = sourceSelect.limit;
    }

    // DISTINCT
    if (sourceSelect.distinct) {
        targetSelect.distinct = sourceSelect.distinct;
    }
}


// -----------------------------------------------------------------------------
// Build local Value Help query
// -----------------------------------------------------------------------------

function buildLocalValueHelpQuery(req, valueHelpName, config, scope) {

    const sourceEntity = config.entity;

    const sourceSelect = req.query?.SELECT || {};

    const columns = config.columns.map(column => ({
        ref: [column]
    }));

    const query = SELECT
        .distinct
        .from(sourceEntity)
        .columns(columns);


    // -------------------------------------------------------------------------
    // Preserve incoming OData query options
    // -------------------------------------------------------------------------

    copyQueryOptions(
        sourceSelect,
        query.SELECT
    );


    // -------------------------------------------------------------------------
    // Apply existing Customer + WBS authorization
    // -------------------------------------------------------------------------
    //
    // IMPORTANT:
    //
    // buildScopeExpression() already knows how to construct:
    //
    //     customerCode
    //     wbsProjectCode
    //
    // and preserves Customer + WBS assignment pairing.
    //
    // We only change the target entity used for the scope expression.
    // We DO NOT modify userScope.js.
    // -------------------------------------------------------------------------

    if (config.scope) {

        const scopeExpression = buildScopeExpression(
            {
                ...req,
                target: {
                    name: sourceEntity
                }
            },
            scope
        );

        if (scopeExpression) {

            const existingWhere = query.SELECT.where;

            if (existingWhere?.length) {

                query.SELECT.where = [
                    "(",
                    ...existingWhere,
                    ")",
                    "and",
                    ...scopeExpression
                ];

            } else {

                query.SELECT.where = scopeExpression;

            }
        }
    }


    return query;
}


// -----------------------------------------------------------------------------
// Read local Value Help
// -----------------------------------------------------------------------------

async function readLocalValueHelp(req, valueHelpName, config, scope) {

    const query = buildLocalValueHelpQuery(
        req,
        valueHelpName,
        config,
        scope
    );

    console.log(
        `[VALUE HELP] ${valueHelpName} -> LOCAL`
    );

    console.log(
        `[VALUE HELP] ${valueHelpName} authorization applied: ` +
        `customer=${scope.customerIds?.join(",") || "none"}, ` +
        `projects=${scope.projectIds?.join(",") || "none"}`
    );

    const tx = cds.tx(req);

    return tx.run(query);
}


// -----------------------------------------------------------------------------
// Register Value Help authorization
// -----------------------------------------------------------------------------

function registerValueHelpScope(srv) {

  // -----------------------------------------------------------------------------
// Hybrid Value Help READ handlers
// -----------------------------------------------------------------------------
//
// These Value Helps have two possible sources:
//
//     HP       -> MDM
//     Customer -> LOCAL
//
// We handle the routing here explicitly.
//
// DO NOT call next().
// DO NOT return undefined for HP.
// HP must explicitly call readMdmValueHelp().
// -----------------------------------------------------------------------------

for (const [valueHelpName, config] of Object.entries(VALUE_HELP_CONFIG)) {

    srv.on("READ", valueHelpName, async req => {

        const scope = await loadUserScope(req);

        const groupIndicator = scope.groupIndicator;


        // ---------------------------------------------------------------------
        // HP
        // ---------------------------------------------------------------------

        if (groupIndicator === "HP") {

            console.log(
                `${valueHelpName} -> MDM`
            );

            return readMdmValueHelp(
                req,
                valueHelpName
            );
        }


        // ---------------------------------------------------------------------
        // Customer
        // ---------------------------------------------------------------------

        if (groupIndicator === "C") {

            // -------------------------------------------------------------
            // Customer visibility
            // -------------------------------------------------------------

            if (!CUSTOMER_VISIBLE_VALUE_HELPS.has(valueHelpName)) {

                console.log(
                    `${valueHelpName} hidden for ` +
                    `${scope.email || "customer"}`
                );

                return [];
            }


            // -------------------------------------------------------------
            // Customer must have a valid scope
            // -------------------------------------------------------------

            if (
                !scope.customerIds ||
                scope.customerIds.length === 0
            ) {

                console.log(
                    `${valueHelpName} customer scope empty -> []`
                );

                return [];
            }


            // -------------------------------------------------------------
            // LOCAL
            // -------------------------------------------------------------

            console.log(
                `${valueHelpName} -> LOCAL`
            );

            console.log(
                `${valueHelpName} authorization applied: ` +
                `customer=${scope.customerIds?.join(",") || "none"}, ` +
                `projects=${scope.projectIds?.join(",") || "none"}`
            );

            return readLocalValueHelp(
                req,
                valueHelpName,
                config,
                scope
            );
        }


        // ---------------------------------------------------------------------
        // Unknown / unsupported group
        // ---------------------------------------------------------------------

        console.log(
            `${valueHelpName} unsupported group=${groupIndicator} -> []`
        );

        return [];
    });
}
 


    // -------------------------------------------------------------------------
    // 2. Local READ handlers
    // -------------------------------------------------------------------------
    //
    // IMPORTANT:
    //
    // These handlers are only responsible for Customer/local requests.
    //
    // We do NOT call next().
    //
    // For HP requests, the handler returns undefined so the existing MDM
    // handler can continue.
    // -------------------------------------------------------------------------

    for (const [valueHelpName, config] of Object.entries(VALUE_HELP_CONFIG)) {

        srv.on("READ", valueHelpName, async req => {

            // -------------------------------------------------------------
            // Only handle Customer LOCAL requests.
            // -------------------------------------------------------------

            if (!req._valueHelpLocal) {
                return;
            }


            const scope = req._valueHelpScope;

            if (!scope) {

                console.log(
                    `${valueHelpName} missing scope -> empty`
                );

                return [];
            }


            // -------------------------------------------------------------
            // Customer authorization
            // -------------------------------------------------------------

            if (scope.groupIndicator !== "C") {

                return [];
            }


            // -------------------------------------------------------------
            // No customer assignment -> empty
            // -------------------------------------------------------------

            if (
                !scope.customerIds ||
                scope.customerIds.length === 0
            ) {

                console.log(
                    `${valueHelpName} no customer scope -> empty`
                );

                return [];
            }


            // -------------------------------------------------------------
            // Execute LOCAL query against SalesOrders / SalesOrderItems
            // -------------------------------------------------------------

            return readLocalValueHelp(
                req,
                valueHelpName,
                config,
                scope
            );
        });
    }


    // -------------------------------------------------------------------------
    // 3. MDM-only Value Helps
    // -------------------------------------------------------------------------
    //
    // Do NOT register these again if they already have an explicit MDM READ
    // handler in the service implementation.
    //
    // For Customer users, they must return empty.
    //
    // For HP users, the existing MDM handler remains responsible for the
    // actual remote read.
    // -------------------------------------------------------------------------

    for (const valueHelpName of Object.keys(MDM_VALUE_HELP_CONFIG)) {

        // -------------------------------------------------------------
        // Hybrid VH already handled above.
        // -------------------------------------------------------------

        if (isConfiguredValueHelp(valueHelpName)) {
            continue;
        }


        srv.before("READ", valueHelpName, async req => {

            const scope = await loadUserScope(req);

            const groupIndicator = scope.groupIndicator;


            // -------------------------------------------------------------
            // HP
            // -------------------------------------------------------------

            if (groupIndicator === "HP") {

                console.log(
                    `${valueHelpName} source determination: ` +
                    `group=HP, source=MDM`
                );

                return;
            }


            // -------------------------------------------------------------
            // Customer
            // -------------------------------------------------------------

            if (groupIndicator === "C") {

                console.log(
                    `${valueHelpName} source determination: ` +
                    `group=C, source=LOCAL`
                );


                // Customer cannot use MDM-only VH.
                console.log(
                    `${valueHelpName} hidden for ` +
                    `${scope.email || "customer"}`
                );

                makeValueHelpEmpty(req);

                return;
            }


            // -------------------------------------------------------------
            // Unknown group
            // -------------------------------------------------------------

            console.log(
                `${valueHelpName} unsupported group=${groupIndicator} -> empty`
            );

            makeValueHelpEmpty(req);
        });
    }
}


// -----------------------------------------------------------------------------
// Export
// -----------------------------------------------------------------------------

module.exports = {
    registerValueHelpScope,
    VALUE_HELP_CONFIG,
    CUSTOMER_VISIBLE_VALUE_HELPS
};