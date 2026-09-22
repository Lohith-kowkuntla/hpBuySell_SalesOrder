"use strict";

const cds = require("@sap/cds");
const { SELECT } = cds.ql;

const {
    loadUserScope,
    buildScopeExpression
} = require("./userScope");

const {
    isMdmValueHelp,
    readMdmValueHelp
} = require("./mdmValueHelps");

const LOG =
    cds.log("sales-order-value-help-scope");

const MDM_SERVICE_NAME =
    "hpbuysell_mdm_common_srv_dest";


// ============================================================================
// Customer-visible Value Helps
// ============================================================================

const CUSTOMER_VISIBLE_VALUE_HELPS =
    new Set([

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


// ============================================================================
// LOCAL Value Help configuration
//
// Only Value Helps whose source is LOCAL are defined here.
//
// MDM Value Helps are handled by mdmValueHelps.js.
// ============================================================================

const VALUE_HELP_CONFIG = {

    // ------------------------------------------------------------------------
    // CUSTOMER
    // ------------------------------------------------------------------------

    VH_Customer: {

        source: "local",

        entity:
            "hpbuysell.otc.salesorder.SalesOrders",

        columns: [
            "customerCode",
            "customerDescription"
        ],

        scope: true
    },


    VH_CustomerName: {

        source: "local",

        entity:
            "hpbuysell.otc.salesorder.SalesOrders",

        columns: [
            "customerCode",
            "customerDescription"
        ],

        scope: true
    },


    // ------------------------------------------------------------------------
    // SALES ORDER
    // ------------------------------------------------------------------------

    VH_SalesOrderNumber: {

        source: "local",

        entity:
            "hpbuysell.otc.salesorder.SalesOrders",

        columns: [
            "hpSalesOrder",
            "customerDescription"
        ],

        scope: true
    },


    VH_CustomerOrder: {

        source: "local",

        entity:
            "hpbuysell.otc.salesorder.SalesOrders",

        columns: [
            "customerOrder"
        ],

        scope: true
    },


    // ------------------------------------------------------------------------
    // CUSTOMER PART NUMBER
    // ------------------------------------------------------------------------

    VH_CustomerPart: {

        source: "local",

        entity:
            "hpbuysell.otc.salesorder.SalesOrderItems",

        columns: [
            "customerPartNumber"
        ],

        scope: true
    },


    // ------------------------------------------------------------------------
    // HP SALES ORDER
    // ------------------------------------------------------------------------

    VH_SalesOrder: {

        source: "local",

        entity:
            "hpbuysell.otc.salesorder.SalesOrders",

        columns: [
            "hpSalesOrder"
        ],

        scope: true
    },


    // ------------------------------------------------------------------------
    // LINE ID
    // ------------------------------------------------------------------------

    VH_LineId: {

        source: "local",

        entity:
            "hpbuysell.otc.salesorder.SalesOrderItems",

        columns: [
            "lineId"
        ],

        scope: true
    },


    // ------------------------------------------------------------------------
    // LOCAL CODE LISTS
    // ------------------------------------------------------------------------

    VH_OrderStatus: {

        source: "local",

        entity:
            "hpbuysell.otc.salesorder.SalesOrders",

        columns: [
            "salesOrderStatus_code"
        ],

        scope: true
    },


    VH_LineStatus: {

        source: "local",

        entity:
            "hpbuysell.otc.salesorder.SalesOrderItems",

        columns: [
            "lineStatus_code"
        ],

        scope: true
    },


    VH_SalesOrderOrigin: {

        source: "local",

        entity:
            "hpbuysell.otc.salesorder.SalesOrders",

        columns: [
            "salesOrderOrigin_code"
        ],

        scope: true
    },


    VH_SoAckOutOrigin: {

        source: "local",

        entity:
            "hpbuysell.otc.salesorder.SalesOrderItems",

        columns: [
            "soAckOutOrigin_code"
        ],

        scope: true
    },


    VH_SoChangeInOrigin: {

        source: "local",

        entity:
            "hpbuysell.otc.salesorder.SalesOrderItems",

        columns: [
            "soChangeInOrigin_code"
        ],

        scope: true
    },


    // ------------------------------------------------------------------------
    // SPECIAL DEAL
    // ------------------------------------------------------------------------

    VH_SpecialDealFlag: {

        source: "local",

        entity:
            "hpbuysell.otc.salesorder.SalesOrders",

        columns: [
            "specialDealFlagSo"
        ],

        scope: true
    },


    // ------------------------------------------------------------------------
    // SALES ORDER TYPE
    // ------------------------------------------------------------------------

    VH_SalesOrderType: {

        source: "local",

        entity:
            "hpbuysell.otc.salesorder.SalesOrders",

        columns: [
            "salesOrderType_code"
        ],

        scope: true
    },


    // ------------------------------------------------------------------------
    // BILL TO
    // ------------------------------------------------------------------------

    VH_BillTo: {

        source: "local",

        entity:
            "hpbuysell.otc.salesorder.SalesOrders",

        columns: [
            "billTo",
            "billToDescription"
        ],

        scope: true
    }
};


// ============================================================================
// CDS entity resolver
// ============================================================================

function getCdsEntity(entityName) {

    const definition =
        cds.model?.definitions?.[entityName];

    if (!definition) {

        throw new Error(
            `[value-help-scope] ` +
            `CDS entity not found: ${entityName}`
        );
    }

    return definition;
}


// ============================================================================
// Combine WHERE conditions
// ============================================================================

function combineWhere(
    existingWhere,
    authorizationWhere
) {

    if (
        existingWhere?.length &&
        authorizationWhere?.length
    ) {

        return [
            "(",
            ...existingWhere,
            ")",
            "and",
            "(",
            ...authorizationWhere,
            ")"
        ];
    }

    if (authorizationWhere?.length) {
        return authorizationWhere;
    }

    return existingWhere;
}


// ============================================================================
// Customer VH visibility
// ============================================================================

function isCustomerValueHelpVisible(
    valueHelpName
) {

    return CUSTOMER_VISIBLE_VALUE_HELPS.has(
        valueHelpName
    );
}


// ============================================================================
// Authorization
// ============================================================================

async function getValueHelpAuthorization(
    req,
    valueHelpName
) {

    const scope =
        await loadUserScope(req);


    // HP / technical
    if (scope?.unrestricted) {

        return {
            scope,
            allowed: true
        };
    }


    // Unknown user
    if (!scope) {

        return {
            scope,
            allowed: false
        };
    }


    // Customer
    if (scope.customerUser) {

        if (
            !isCustomerValueHelpVisible(
                valueHelpName
            )
        ) {

            LOG.info(
                `[value-help-scope] ` +
                `${valueHelpName} hidden for ` +
                `${scope.email}`
            );

            return {
                scope,
                allowed: false
            };
        }
    }


    return {
        scope,
        allowed: true
    };
}


// ============================================================================
// Preserve UI options
// ============================================================================

function copyQueryOptions(
    sourceSelect,
    targetSelect
) {

    if (!sourceSelect) {
        return;
    }

    if (sourceSelect.search) {
        targetSelect.search =
            sourceSelect.search;
    }

    if (sourceSelect.orderBy) {
        targetSelect.orderBy =
            sourceSelect.orderBy;
    }

    if (sourceSelect.groupBy) {
        targetSelect.groupBy =
            sourceSelect.groupBy;
    }

    if (sourceSelect.having) {
        targetSelect.having =
            sourceSelect.having;
    }

    if (sourceSelect.limit) {
        targetSelect.limit =
            sourceSelect.limit;
    }
}


// ============================================================================
// Build local VH
// ============================================================================

async function buildLocalValueHelpQuery(
    req,
    valueHelpName,
    config,
    scope
) {

    const sourceEntity =
        getCdsEntity(config.entity);


    const query =
        SELECT.distinct
            .from(sourceEntity)
            .columns(
                ...config.columns
            );


    const incomingSelect =
        req.query?.SELECT;


    const existingWhere =
        incomingSelect?.where;


    let authorizationWhere = null;


    if (
        scope &&
        !scope.unrestricted &&
        config.scope
    ) {

        authorizationWhere =
            buildScopeExpression(
                {
                    ...req,
                    target: sourceEntity
                },
                scope
            );
    }


    query.SELECT.where =
        combineWhere(
            existingWhere,
            authorizationWhere
        );


    copyQueryOptions(
        incomingSelect,
        query.SELECT
    );


    return query;
}


// ============================================================================
// Read local VH
// ============================================================================

async function readLocalValueHelp(
    req,
    valueHelpName,
    config,
    scope
) {

    const query =
        await buildLocalValueHelpQuery(
            req,
            valueHelpName,
            config,
            scope
        );


    return cds.tx(req).run(
        query
    );
}


// ============================================================================
// Read authorized Buyer codes
//
// IMPORTANT:
// This does NOT change loadUserScope().
// This only uses the existing scope to determine
// which Buyer codes exist in authorized SalesOrders.
// ============================================================================

async function readAuthorizedBuyerCodes(
    req,
    scope
) {

    const entity =
        getCdsEntity(
            "hpbuysell.otc.salesorder.SalesOrders"
        );


    const query =
        SELECT.distinct
            .from(entity)
            .columns(
                "hpBuyerCode"
            );


    const authorizationWhere =
        buildScopeExpression(
            {
                ...req,
                target: entity
            },
            scope
        );


    query.SELECT.where =
        authorizationWhere;


    const rows =
        await cds.tx(req).run(
            query
        );


    return [
        ...new Set(
            (rows || [])
                .map(
                    row =>
                        row.hpBuyerCode
                )
                .filter(Boolean)
        )
    ];
}


// ============================================================================
// Build Buyer authorization condition for MDM
// ============================================================================

async function buildBuyerAuthorizationWhere(
    req,
    scope
) {

    if (!scope || scope.unrestricted) {
        return null;
    }


    const allowedBuyerCodes =
        await readAuthorizedBuyerCodes(
            req,
            scope
        );


    if (
        allowedBuyerCodes.length === 0
    ) {

        return [
            {
                ref: ["buyercode"]
            },
            "=",
            {
                val: "__NO_AUTHORIZED_BUYER__"
            }
        ];
    }


    const condition = [];


    allowedBuyerCodes.forEach(
        (
            buyerCode,
            index
        ) => {

            if (index > 0) {
                condition.push("or");
            }

            condition.push(
                {
                    ref: ["buyercode"]
                },
                "=",
                {
                    val: buyerCode
                }
            );
        }
    );


    return condition;
}


// ============================================================================
// Read MDM VH
// ============================================================================

async function readMdmScopedValueHelp(
    req,
    valueHelpName,
    scope
) {

    let additionalWhere = null;


    /*
     * Customer Buyer authorization.
     *
     * Existing Customer + WBS scope is used to determine
     * authorized Buyer codes from SalesOrders.
     */
    if (
        scope &&
        !scope.unrestricted &&
        (
            valueHelpName === "VH_Buyer" ||
            valueHelpName === "VH_BuyerName"
        )
    ) {

        additionalWhere =
            await buildBuyerAuthorizationWhere(
                req,
                scope
            );
    }


    return readMdmValueHelp(
        req,
        valueHelpName,
        additionalWhere
    );
}


// ============================================================================
// READ ONE VALUE HELP
// ============================================================================

async function readValueHelp(
    req,
    valueHelpName
) {

    const authorization =
        await getValueHelpAuthorization(
            req,
            valueHelpName
        );


    /*
     * Server-side N/A enforcement.
     *
     * No MDM fallback.
     * No local fallback.
     */
    if (!authorization.allowed) {

        return [];
    }


    const scope =
        authorization.scope;


    /*
     * MDM Value Help
     */
    if (
        isMdmValueHelp(
            valueHelpName
        )
    ) {
        LOG.info(
            `[value-help-scope] ` +
            `${valueHelpName} -> MDM`
        );

        return readMdmScopedValueHelp(
            req,
            valueHelpName,
            scope
        );
    }


    /*
     * Local Value Help
     */
    const config =
        VALUE_HELP_CONFIG[valueHelpName];


    if (!config) {

        return req.reject(
            400,
            `Unknown value help: ${valueHelpName}`
        );
    }


    return readLocalValueHelp(
        req,
        valueHelpName,
        config,
        scope
    );
}


// ============================================================================
// REGISTER HANDLERS
// ============================================================================

function registerValueHelpScope(srv) {

    /*
     * Register LOCAL VHs.
     */
    for (
        const valueHelpName
        of Object.keys(
            VALUE_HELP_CONFIG
        )
    ) {

        srv.on(
            "READ",
            valueHelpName,
            async req => {

                return readValueHelp(
                    req,
                    valueHelpName
                );
            }
        );
    }


    /*
     * Register MDM VHs.
     */
    for (
        const valueHelpName
        of Object.keys(
            require("./mdmValueHelps")
                .MDM_VALUE_HELP_CONFIG
        )
    ) {

        srv.on(
            "READ",
            valueHelpName,
            async req => {

                return readValueHelp(
                    req,
                    valueHelpName
                );
            }
        );
    }


    LOG.info(
        "[value-help-scope] " +
        "Sales Order Value Help handlers registered"
    );
}


// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {

    registerValueHelpScope,

    readValueHelp,

    buildLocalValueHelpQuery,

    VALUE_HELP_CONFIG,

    CUSTOMER_VISIBLE_VALUE_HELPS,

    isCustomerValueHelpVisible
};