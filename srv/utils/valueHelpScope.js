//-----------------------------------------------------------------------------------*
// Confidential and Proprietary
// Copyright 2026, HP
// All Rights Reserved
//-----------------------------------------------------------------------------------*
// Value Help authorization + source routing.
//
// Three distinct problems used to be conflated in one hybrid table, which is
// exactly why VH_Customer/VH_OrderStatus/VH_SalesOrderType were broken:
//
//   1. SOURCE  - where does this value help's data actually live?
//        "local"    Sales-Order-specific data with no MDM equivalent
//                    (VH_Customer, VH_SalesOrderNumber, ...)
//        "mdm"      genuine MDM master data (VH_BusinessModel, VH_Buyer, ...)
//        "static"   @cds.persistence.skip boolean code lists with no table
//                    at all (VH_SpecialDealFlag, VH_GtsHold, VH_BlanketIndicator)
//        (passthrough) plain CDS projections over shared, non-customer-
//                    specific code lists (VH_OrderStatus, VH_LineStatus,
//                    VH_SalesOrderType, VH_SalesOrderOrigin,
//                    VH_SoAckOutOrigin, VH_ReasonForCancellation) are
//                    deliberately NOT registered here at all - they already
//                    work correctly via CAP's generic READ handler, because
//                    their exposed field names already match their own CDS
//                    projection. Redirecting them onto SalesOrders (as the
//                    old VALUE_HELP_CONFIG did) is exactly what broke them.
//
//   2. FIELD MAPPING - once the source is decided, exposed VH field names
//      (e.g. "code") must be translated to the real source column (e.g.
//      "salesOrderType_code", or plain "soAckOutOrigin" with NO "_code"
//      suffix - it isn't an association). See valueHelpFieldTranslation.js.
//
//   3. AUTHORIZATION - Customer users may only see values derived from Sales
//      Orders their Customer Code + WBS Project assignment actually grants
//      them (buildScopeExpression, already used for the Overview list
//      itself). HP users are unrestricted UNLESS the field is one already
//      hidden from Customer users entirely (CUSTOMER_HIDDEN, userScope.js) -
//      in that case the value help is HP-only, for consistency with the
//      field-level policy already enforced on SalesOrders/SalesOrderItems.
//-----------------------------------------------------------------------------------*

"use strict";

const cds = require("@sap/cds");
const { SELECT } = cds.ql;

const LOG = cds.log("sales-order-value-help");

const {
    loadUserScope,
    buildScopeExpression,
    CUSTOMER_HIDDEN
} = require("./userScope");

const {
    isMdmValueHelp,
    readMdmValueHelp,
    localColumnToMdmField
} = require("./mdmValueHelps");

const {
    UnknownValueHelpFieldError,
    translateExpr,
    buildSourceColumns,
    mapRowToOutput,
    resolveReader,
    validateFieldMapAgainstCsn
} = require("./valueHelpFieldTranslation");


const SALES_ORDERS = "hpbuysell.otc.salesorder.SalesOrders";
const SALES_ORDER_ITEMS = "hpbuysell.otc.salesorder.SalesOrderItems";

const YES_NO_ROWS = [
    { code: true, description: "Yes" },
    { code: false, description: "No" }
];


// -----------------------------------------------------------------------------
// Value Help configuration
// -----------------------------------------------------------------------------
//
// fieldMap keys are the field names exposed on the VH_* OData entity; values
// are the *real* column on sourceEntity. Verified against
// db/hpbuysell-otc-salesorder-model.cds - not assumed - and re-verified at
// startup by validateAllFieldMaps() below.
// -----------------------------------------------------------------------------

const VALUE_HELP_CONFIG = {

    // -------------------------------------------------------------------
    // local - Sales-Order-specific, no MDM equivalent
    // -------------------------------------------------------------------

    VH_Customer: {
        source: "local",
        sourceEntity: SALES_ORDERS,
        scopeLevel: "header",
        hiddenFields: ["customerCode"],
        fields: { customerCode: "customerCode" }
        // customerDescription is NOT mapped: no such column exists on
        // SalesOrders (it's only ever resolved from MDM). Requesting it
        // throws UnknownValueHelpFieldError instead of a silent 500.
    },

    VH_SalesOrderNumber: {
        source: "local",
        sourceEntity: SALES_ORDERS,
        scopeLevel: "header",
        hiddenFields: ["hpSalesOrder"],
        fields: { hpSalesOrder: "hpSalesOrder" }
    },

    VH_CustomerOrder: {
        source: "local",
        sourceEntity: SALES_ORDERS,
        scopeLevel: "header",
        hiddenFields: ["customerOrder"],
        fields: { customerOrder: "customerOrder" }
    },

    VH_SalesOrganization: {
        source: "local",
        sourceEntity: SALES_ORDERS,
        scopeLevel: "header",
        hiddenFields: ["hpSalesOrganization"],
        fields: { hpSalesOrganization: "hpSalesOrganization" }
    },

    VH_BusinessUnit: {
        source: "local",
        sourceEntity: SALES_ORDERS,
        scopeLevel: "header",
        hiddenFields: ["businessUnit"],
        fields: { businessUnit: "businessUnit" }
    },

    VH_ShipTo: {
        source: "local",
        sourceEntity: SALES_ORDERS,
        scopeLevel: "header",
        hiddenFields: ["shipTo"],
        fields: { shipTo: "shipTo" }
    },

    VH_BillTo: {
        source: "local",
        sourceEntity: SALES_ORDERS,
        scopeLevel: "header",
        hiddenFields: ["billTo"],
        fields: { billTo: "billTo" }
    },

    VH_Payer: {
        source: "local",
        sourceEntity: SALES_ORDERS,
        scopeLevel: "header",
        hiddenFields: ["payer"],
        fields: { payer: "payer" }
    },

    VH_OtherShipTo: {
        source: "local",
        sourceEntity: SALES_ORDERS,
        scopeLevel: "header",
        hiddenFields: ["otherShipTo"],
        fields: { otherShipTo: "otherShipTo" }
    },

    VH_PaymentTerms: {
        source: "local",
        sourceEntity: SALES_ORDERS,
        scopeLevel: "header",
        hiddenFields: ["paymentTerms"],
        fields: { paymentTerms: "paymentTerms" }
    },

    VH_CustomerPart: {
        source: "local",
        sourceEntity: SALES_ORDER_ITEMS,
        scopeLevel: "item",
        hiddenFields: ["customerPartNumber"],
        fields: {
            customerPartNumber: "customerPartNumber",
            hpPartNumber: "hpPartNumber",
            hpPartDescription: "hpPartDescription"
        }
    },

    VH_EndSupplier: {
        source: "local",
        sourceEntity: SALES_ORDER_ITEMS,
        scopeLevel: "item",
        hiddenFields: ["endSupplier"],
        fields: { endSupplier: "endSupplier" }
    },

    // -------------------------------------------------------------------
    // VH_SoAckOutOrigin (SoAckOutOrigins CodeList) and VH_SoChangeInOrigin
    // (now served by VH_SalesOrderOrigin, over the SalesOrderOrigins
    // CodeList) are, like VH_OrderStatus/VH_SalesOrderOrigin above,
    // deliberately NOT registered here - they are plain CDS projections
    // over real CodeList tables and already work via CAP's generic READ
    // handler.
    // -------------------------------------------------------------------

    // -------------------------------------------------------------------
    // mdm - genuine MDM master data. Must have a matching entry in
    // MDM_VALUE_HELP_CONFIG (mdmValueHelps.js) - enforced by resolveReader.
    // localKeyField names the local column used to compute the Customer
    // user's authorized set of values before intersecting with MDM.
    // -------------------------------------------------------------------

    VH_BusinessModel: {
        source: "mdm",
        hiddenFields: ["businessModel"],
        localKeyField: { entity: SALES_ORDERS, scopeLevel: "header", column: "businessModel" }
    },

    VH_Buyer: {
        source: "mdm",
        hiddenFields: ["hpBuyerCode"],
        localKeyField: { entity: SALES_ORDERS, scopeLevel: "header", column: "hpBuyerCode" }
    },

    VH_CompanyCode: {
        source: "mdm",
        hiddenFields: ["hpCompanyCode"],
        localKeyField: { entity: SALES_ORDERS, scopeLevel: "header", column: "hpCompanyCode" }
    },

    VH_WbsProject: {
        source: "mdm",
        hiddenFields: ["wbsProjectCode"],
        localKeyField: { entity: SALES_ORDERS, scopeLevel: "header", column: "wbsProjectCode" }
    },

    VH_HpPartNumber: {
        source: "mdm",
        hiddenFields: ["hpPartNumber"],
        localKeyField: { entity: SALES_ORDER_ITEMS, scopeLevel: "item", column: "hpPartNumber" }
    },

    VH_Plant: {
        source: "mdm",
        hiddenFields: ["hpPlant"],
        localKeyField: { entity: SALES_ORDERS, scopeLevel: "header", column: "hpPlant" }
    },

    VH_StorageLocation: {
        source: "mdm",
        hiddenFields: ["storageLocation"],
        localKeyField: { entity: SALES_ORDER_ITEMS, scopeLevel: "item", column: "storageLocation" }
    },

    // -------------------------------------------------------------------
    // static - @cds.persistence.skip entities with no backing table at
    // all. CAP's generic READ handler cannot serve these; a custom handler
    // must supply the two hardcoded rows.
    // -------------------------------------------------------------------

    VH_SpecialDealFlag: {
        source: "static",
        hiddenEntity: "SalesOrderItems",
        hiddenFields: ["specialDealFlagSo"],
        rows: YES_NO_ROWS
    },

    VH_GtsHold: {
        source: "static",
        hiddenEntity: "SalesOrderItems",
        hiddenFields: ["gtsHold"],
        rows: YES_NO_ROWS
    },

    VH_BlanketIndicator: {
        source: "static",
        hiddenEntity: "SalesOrders",
        hiddenFields: [],
        rows: YES_NO_ROWS
    }
};


// -----------------------------------------------------------------------------
// Customer visibility - derived from CUSTOMER_HIDDEN, not hand-maintained.
//
// A value help is hidden from Customer users whenever the field(s) behind it
// are already hidden from them on SalesOrders/SalesOrderItems - the same
// policy enforced everywhere else, so a value help can never leak a field a
// Customer isn't allowed to see through the entity itself.
// -----------------------------------------------------------------------------

function hiddenEntityForConfig(valueHelpName, config) {

    if (config.hiddenEntity) {
        return config.hiddenEntity;
    }

    const entity = config.sourceEntity || config.localKeyField?.entity;

    if (!entity) {
        return null;
    }

    return entity.split(".").pop();
}


function isHiddenFromCustomer(valueHelpName, config) {

    const entityName = hiddenEntityForConfig(valueHelpName, config);

    if (!entityName) {
        return false;
    }

    const hiddenSet = new Set(CUSTOMER_HIDDEN[entityName] || []);

    return (config.hiddenFields || []).some((field) => hiddenSet.has(field));
}


const CUSTOMER_VISIBLE_VALUE_HELPS = new Set(
    Object.entries(VALUE_HELP_CONFIG)
        .filter(([name, config]) => !isHiddenFromCustomer(name, config))
        .map(([name]) => name)
);


// -----------------------------------------------------------------------------
// Startup validation - fail loudly, not on first request
// -----------------------------------------------------------------------------

function validateAllFieldMaps(csnDefinitions) {

    for (const [valueHelpName, config] of Object.entries(VALUE_HELP_CONFIG)) {

        if (config.source === "local" && config.fields) {

            validateFieldMapAgainstCsn(
                csnDefinitions,
                config.sourceEntity,
                config.fields,
                valueHelpName
            );
        }

        if (config.source === "mdm" && config.localKeyField) {

            validateFieldMapAgainstCsn(
                csnDefinitions,
                config.localKeyField.entity,
                { [config.localKeyField.column]: config.localKeyField.column },
                valueHelpName
            );
        }
    }
}


// -----------------------------------------------------------------------------
// Local query construction
// -----------------------------------------------------------------------------

function translateIncomingQuery(req, fieldMap) {

    const sourceSelect = req.query?.SELECT || {};

    const translated = {};

    if (sourceSelect.where) {
        translated.where = translateExpr(sourceSelect.where, fieldMap);
    }

    if (sourceSelect.orderBy) {
        translated.orderBy = translateExpr(sourceSelect.orderBy, fieldMap);
    }

    // $search has no field references (it's a bare literal term applied
    // across text columns by the DB adapter) - safe to copy verbatim.
    if (sourceSelect.search) {
        translated.search = sourceSelect.search;
    }

    if (sourceSelect.limit) {
        translated.limit = sourceSelect.limit;
    }

    return translated;
}


function buildLocalValueHelpQuery(req, valueHelpName, config, scope) {

    const query = SELECT
        .distinct
        .from(config.sourceEntity)
        .columns(buildSourceColumns(config.fields));

    const translated = translateIncomingQuery(req, config.fields);

    if (translated.where?.length) {
        query.where(translated.where);
    }

    if (translated.orderBy) {
        query.SELECT.orderBy = translated.orderBy;
    }

    if (translated.search) {
        query.SELECT.search = translated.search;
    }

    if (translated.limit) {
        query.SELECT.limit = translated.limit;
    }

    // ---------------------------------------------------------------
    // Authorization scope - applied AFTER client filters, ANDed in, so
    // a client can never widen it. Header/item level path (through the
    // parent SalesOrder association for item-level VHs) is already
    // encoded in userScope.js's SCOPE_PATHS.
    // ---------------------------------------------------------------

    const scopeExpression = buildScopeExpression(
        { target: { name: config.sourceEntity.split(".").pop() } },
        scope
    );

    if (scopeExpression) {

        const existingWhere = query.SELECT.where;

        if (existingWhere?.length) {

            query.SELECT.where = ["(", ...existingWhere, ")", "and", "(", ...scopeExpression, ")"];

        } else {

            query.SELECT.where = scopeExpression;
        }
    }

    return query;
}


async function readLocalValueHelp(req, valueHelpName, config, scope) {

    let query;

    try {

        query = buildLocalValueHelpQuery(req, valueHelpName, config, scope);

    } catch (error) {

        if (error instanceof UnknownValueHelpFieldError) {

            return req.reject(400, error.message);
        }

        throw error;
    }

    LOG.info(
        `[VALUE HELP] ${valueHelpName} -> LOCAL (${config.sourceEntity}), ` +
        `scope=${scope.unrestricted ? "unrestricted" : (scope.customerIds?.join(",") || "none")}`
    );

    const tx = cds.tx(req);
    const rows = await tx.run(query);

    return rows
        .filter((row) => Object.values(row).some((value) => value !== null && value !== undefined && value !== ""))
        .map((row) => mapRowToOutput(row, config.fields));
}


// -----------------------------------------------------------------------------
// Authorized local keys, for scoping an MDM lookup
// -----------------------------------------------------------------------------

async function getAuthorizedLocalKeys(req, localKeyField, scope) {

    const query = SELECT
        .distinct
        .from(localKeyField.entity)
        .columns([{ ref: [localKeyField.column] }])
        .where([{ ref: [localKeyField.column] }, "is not null"]);

    const scopeExpression = buildScopeExpression(
        { target: { name: localKeyField.entity.split(".").pop() } },
        scope
    );

    if (scopeExpression) {
        query.where(["(", ...query.SELECT.where, ")", "and", "(", ...scopeExpression, ")"]);
    }

    const tx = cds.tx(req);
    const rows = await tx.run(query);

    return [...new Set(
        rows
            .map((row) => row[localKeyField.column])
            .filter((value) => value !== null && value !== undefined && value !== "")
    )];
}


async function readScopedMdmValueHelp(req, valueHelpName, config, scope) {

    if (scope.unrestricted) {

        LOG.info(`[VALUE HELP] ${valueHelpName} -> MDM (unrestricted)`);

        return readMdmValueHelp(req, valueHelpName);
    }

    if (!config.localKeyField) {

        // No local correlate configured - an unrestricted MDM call would
        // hand a Customer user the entire master catalog, which is exactly
        // what this fix must prevent. Fail closed.
        LOG.warn(
            `[VALUE HELP] ${valueHelpName}: no localKeyField configured, ` +
            `refusing to return the full MDM catalog to a Customer user`
        );

        return [];
    }

    const localValues = await getAuthorizedLocalKeys(req, config.localKeyField, scope);

    if (!localValues.length) {

        LOG.info(`[VALUE HELP] ${valueHelpName}: no authorized local keys -> []`);

        return [];
    }

    const mdmField = localColumnToMdmField(valueHelpName, config.localKeyField.column);

    const additionalWhere = mdmField
        ? [{ ref: [mdmField] }, "in", { list: localValues.map((value) => ({ val: value })) }]
        : null;

    if (!additionalWhere) {

        LOG.warn(
            `[VALUE HELP] ${valueHelpName}: local key column ` +
            `'${config.localKeyField.column}' has no corresponding MDM ` +
            `field - refusing unrestricted MDM call`
        );

        return [];
    }

    LOG.info(
        `[VALUE HELP] ${valueHelpName} -> MDM, scoped to ` +
        `${localValues.length} authorized local value(s)`
    );

    return readMdmValueHelp(req, valueHelpName, additionalWhere);
}


// -----------------------------------------------------------------------------
// Register handlers
// -----------------------------------------------------------------------------

function registerValueHelpScope(srv) {

    validateAllFieldMaps(srv.model.definitions);

    for (const [valueHelpName, config] of Object.entries(VALUE_HELP_CONFIG)) {

        const reader = resolveReader(config, isMdmValueHelp, valueHelpName);

        srv.on("READ", valueHelpName, async (req) => {

            const scope = await loadUserScope(req);

            // -----------------------------------------------------------
            // static - no scope concept, just gated by hiddenFields (via
            // CUSTOMER_VISIBLE_VALUE_HELPS) same as everything else.
            // -----------------------------------------------------------

            if (reader === "static") {

                if (scope.groupIndicator !== "HP" && !CUSTOMER_VISIBLE_VALUE_HELPS.has(valueHelpName)) {
                    return [];
                }

                return config.rows;
            }

            // -----------------------------------------------------------
            // Unknown / unsupported group -> fail closed, same as
            // every other Sales Order read.
            // -----------------------------------------------------------

            if (scope.groupIndicator !== "HP" && scope.groupIndicator !== "C") {

                LOG.warn(`[VALUE HELP] ${valueHelpName}: unsupported group '${scope.groupIndicator}' -> []`);

                return [];
            }

            // -----------------------------------------------------------
            // Field-level visibility - applies to HP and Customer alike,
            // for consistency with the entity-level hidden-fields policy.
            // -----------------------------------------------------------

            if (scope.groupIndicator === "C" && !CUSTOMER_VISIBLE_VALUE_HELPS.has(valueHelpName)) {

                LOG.info(`[VALUE HELP] ${valueHelpName} hidden for ${scope.email || "customer"}`);

                return [];
            }

            if (scope.groupIndicator === "C" && (!scope.customerIds || scope.customerIds.length === 0)) {

                LOG.info(`[VALUE HELP] ${valueHelpName}: customer has no valid scope -> []`);

                return [];
            }

            // -----------------------------------------------------------
            // mdm
            // -----------------------------------------------------------

            if (reader === "mdm") {
                return readScopedMdmValueHelp(req, valueHelpName, config, scope);
            }

            // -----------------------------------------------------------
            // local
            // -----------------------------------------------------------

            return readLocalValueHelp(req, valueHelpName, config, scope);
        });
    }

    LOG.info(
        "[VALUE HELP] Registered " +
        `${Object.keys(VALUE_HELP_CONFIG).length} value help(s): ` +
        `${Object.values(VALUE_HELP_CONFIG).filter((c) => c.source === "local").length} local, ` +
        `${Object.values(VALUE_HELP_CONFIG).filter((c) => c.source === "mdm").length} mdm, ` +
        `${Object.values(VALUE_HELP_CONFIG).filter((c) => c.source === "static").length} static ` +
        "(VH_OrderStatus/VH_LineStatus/VH_SalesOrderType/VH_SalesOrderOrigin/" +
        "VH_ReasonForCancellation are intentionally not registered here - " +
        "they are shared code lists served correctly by CAP's generic READ " +
        "handler directly from their own CDS projection)"
    );
}


// -----------------------------------------------------------------------------
// Export
// -----------------------------------------------------------------------------

module.exports = {
    registerValueHelpScope,
    VALUE_HELP_CONFIG,
    CUSTOMER_VISIBLE_VALUE_HELPS,
    isHiddenFromCustomer,

    // exported for tests only
    buildLocalValueHelpQuery,
    readLocalValueHelp,
    readScopedMdmValueHelp,
    getAuthorizedLocalKeys,
    validateAllFieldMaps
};
