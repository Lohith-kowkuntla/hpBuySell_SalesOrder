//---------------------------------------------------------------------------------*
// Confidential and Proprietary
// Copyright 2026, HP
// All Rights Reserved
//---------------------------------------------------------------------------------*
// Application Name : Sales Order
// Module           : Service
// Namespace        : hpbuysell.otc.salesorder
//---------------------------------------------------------------------------------*

"use strict";

const cds = require("@sap/cds");

const { buildCancelLineOrdchgPayload } =
    require("./integration/ordchg");

const {
    registerUserScope,
    loadUserScope,
    getVisibleFilters
} = require("./utils/userScope");

const {
    registerValueHelpScope
} = require("./utils/valueHelpScope");

const {
    MDM_SERVICE_NAME,
    MAPPINGS: MDM_DESCRIPTIONS,
    resolveDescriptions,
    resolveProjectDetails
} = require("./utils/mdmDescriptionResolver");


// ============================================================================
// EDITABLE FIELDS
// ============================================================================

const EDITABLE_FIELDS = {

    SalesOrders: [
        "hpNotesToCustomer"
    ],

    SalesOrderItems: [
        "salesPrice",
        "salesPriceUnit",
        "specialDealFlagSo",
        "hpNotesToCustomer",
        "hpBacklogNotes",
        "reasonForCancellation_code"
    ]
};


// ============================================================================
// FIELD-LEVEL PROCESSING INDICATORS
// ============================================================================

const FIELD_PROCESSING_FLAGS = {

    SalesOrders: {
        hpNotesToCustomer:
            "hpNotesToCustomerProcessingInd"
    },

    SalesOrderItems: {
        salesPrice:
            "salesPriceProcessingInd",

        salesPriceUnit:
            "salesPriceUnitProcessingInd",

        specialDealFlagSo:
            "specialDealFlagSoProcessingInd",

        hpNotesToCustomer:
            "hpNotesToCustomerProcessingInd",

        hpBacklogNotes:
            "hpBacklogNotesProcessingInd",

        reasonForCancellation_code:
            "reasonForCancellationProcessingInd"
    }
};


// ============================================================================
// LINE STATUS
// ============================================================================

const CANCELLED_LINE_STATUS_CODE = "CANC";

const CANCELLABLE_LINE_STATUS_CODES = [
    "AACK",
    "OPEN",
    "CONF"
];

const { SELECT, UPDATE, INSERT } = cds.ql;


// ============================================================================
// SMALL HELPERS - shared by the UPSERT implementation below
// ============================================================================

function toArray(value) {
    if (value === undefined || value === null) return [];
    return Array.isArray(value) ? value : [value];
}


// ============================================================================
// HEADER SALES ORDER STATUS PRIORITY - FDS 7.6
// ============================================================================

const HEADER_STATUS_PRIORITY = [

    "OPEN",
    "AACK",
    "CONF",
    "CHPR",
    "PSHP",
    "SHIP",
    "DLVD",
    "INVD",
    "CANC"
];


// ============================================================================
// DERIVE HEADER SALES ORDER STATUS
// ============================================================================

async function deriveHeaderSalesOrderStatus(
    salesOrderId,
    SalesOrderItems
) {

    if (!salesOrderId) {
        return null;
    }

    const lineItems =
        await SELECT
            .from(SalesOrderItems)
            .where({
                salesOrder_hpSalesOrder:
                    salesOrderId
            })
            .columns(
                "lineStatus_code"
            );

    if (!lineItems.length) {
        return null;
    }

    const lineStatusCodes =
        new Set(
            lineItems
                .map(
                    item =>
                        item.lineStatus_code
                )
                .filter(Boolean)
        );

    for (
        const statusCode
        of HEADER_STATUS_PRIORITY
    ) {

        if (
            lineStatusCodes.has(
                statusCode
            )
        ) {

            return statusCode;
        }
    }

    return null;
}


// ============================================================================
// UPDATE DERIVED HEADER SALES ORDER STATUS
// ============================================================================

async function updateHeaderSalesOrderStatus(
    salesOrderId,
    SalesOrders,
    SalesOrderItems
) {

    if (!salesOrderId) {
        return null;
    }

    const headerStatus =
        await deriveHeaderSalesOrderStatus(
            salesOrderId,
            SalesOrderItems
        );

    if (!headerStatus) {
        return null;
    }

    const existingHeader =
        await SELECT.one
            .from(SalesOrders)
            .where({
                hpSalesOrder:
                    salesOrderId
            })
            .columns(
                "salesOrderStatus_code"
            );

    if (
        existingHeader &&
        existingHeader.salesOrderStatus_code ===
        headerStatus
    ) {

        return headerStatus;
    }

    await UPDATE(SalesOrders)
        .set({
            salesOrderStatus_code:
                headerStatus
        })
        .where({
            hpSalesOrder:
                salesOrderId
        });

    console.log(
        `[SO STATUS] ${salesOrderId} -> ${headerStatus}`
    );

    return headerStatus;
}


// ============================================================================
// SERVICE IMPLEMENTATION
// ============================================================================

module.exports = cds.service.impl(
    async function (srv) {

        const {
            SalesOrders,
            SalesOrderItems,
            SalesOrderAcknowledgements
        } = srv.entities;


        // -------------------------------------------------------------
        // User scope authorization
        // -------------------------------------------------------------

        registerUserScope(srv);

        // -------------------------------------------------------------
        // Value help authorization
        // -------------------------------------------------------------
        //
        // Uses the same userScope.js authorization logic.
        //
        // Scoped VHs:
        //   VH_Customer
        //   VH_WbsProject
        //   VH_Buyer
        //   VH_CompanyCode
        //
        // -------------------------------------------------------------

        registerValueHelpScope(srv);


        // =====================================================================
        // MDM COMMON SERVICE
        // =====================================================================
        //
        // These are @cds.persistence.skip projections in srv.cds.
        //
        // They MUST have explicit READ handlers because CAP cannot serve
        // @cds.persistence.skip entities generically.
        //
        // The query is forwarded to the remote MDM Common Service through:
        //
        //     hpbuysell_mdm_common_srv_dest
        //
        // =====================================================================

        const MDM_PROJECTIONS = [

            "MDM_Supplier",
            "MDM_Customer",
            "MDM_Project",
            "MDM_Material",
            "MDM_Plant",
            "MDM_StorageLocation",
            "MDM_BusinessModel",

            "MDM_SupplierMaster",
            "MDM_CustomerMaster",
            "MDM_ProjectMaster",
            "MDM_BuyerMaster",
            "MDM_CompanyCodeMaster",

            // -------------------------------------------------------------
            // User Scope
            // -------------------------------------------------------------

            "MDM_User",
            "MDM_UserGroup",
            "MDM_UserPartners",
            "MDM_UserProjects",
            "MDM_BusinessModelVH"

        ];


        for (
            const projection
            of MDM_PROJECTIONS
        ) {

            srv.on(
                "READ",
                projection,
                async (req) => {

                    const mdm =
                        await cds.connect.to(
                            MDM_SERVICE_NAME
                        );

                    return mdm.run(
                        req.query
                    );
                }
            );
        }


        // =====================================================================
        // STATIC VALUE HELP - SPECIAL DEAL FLAG
        // =====================================================================

        srv.on(
            "READ",
            "VH_SpecialDealFlag",
            async () => {

                return [
                    {
                        code: true,
                        description: "Yes"
                    },
                    {
                        code: false,
                        description: "No"
                    }
                ];

            }
        );


        // =====================================================================
        // STATIC VALUE HELP - GTS HOLD
        // =====================================================================

        srv.on(
            "READ",
            "VH_GtsHold",
            async () => {

                return [
                    {
                        code: true,
                        description: "Yes"
                    },
                    {
                        code: false,
                        description: "No"
                    }
                ];

            }
        );


        // =====================================================================
        // STATIC VALUE HELP - BLANKET INDICATOR
        // =====================================================================

        srv.on(
            "READ",
            "VH_BlanketIndicator",
            async () => {

                return [
                    {
                        code: true,
                        description: "Yes"
                    },
                    {
                        code: false,
                        description: "No"
                    }
                ];

            }
        );


        // =====================================================================
        // DERIVE HEADER STATUS WHEN SALES ORDER IS READ
        // =====================================================================

        srv.after(
            "READ",
            SalesOrders,
            async (data) => {

                if (!data) {
                    return;
                }

                const salesOrders =
                    Array.isArray(data)
                        ? data
                        : [data];


                // -------------------------------------------------------------
                // Calculate header status
                // -------------------------------------------------------------

                await Promise.all(
                    salesOrders.map(
                        async (salesOrder) => {

                            if (
                                !salesOrder.hpSalesOrder
                            ) {
                                return;
                            }

                            const headerStatus =
                                await deriveHeaderSalesOrderStatus(
                                    salesOrder.hpSalesOrder,
                                    SalesOrderItems
                                );

                            if (!headerStatus) {
                                return;
                            }

                            // Expose calculated status to UI
                            salesOrder.salesOrderStatus_code =
                                headerStatus;
                        }
                    )
                );


                // -------------------------------------------------------------
                // Synchronize calculated status with DB
                // -------------------------------------------------------------

                await Promise.all(
                    salesOrders.map(
                        async (salesOrder) => {

                            if (
                                !salesOrder.hpSalesOrder
                            ) {
                                return;
                            }

                            const headerStatus =
                                salesOrder.salesOrderStatus_code;

                            if (!headerStatus) {
                                return;
                            }

                            const dbHeader =
                                await SELECT.one
                                    .from(SalesOrders)
                                    .where({
                                        hpSalesOrder:
                                            salesOrder.hpSalesOrder
                                    })
                                    .columns(
                                        "salesOrderStatus_code"
                                    );

                            if (
                                !dbHeader ||
                                dbHeader.salesOrderStatus_code !==
                                headerStatus
                            ) {

                                await UPDATE(SalesOrders)
                                    .set({
                                        salesOrderStatus_code:
                                            headerStatus
                                    })
                                    .where({
                                        hpSalesOrder:
                                            salesOrder.hpSalesOrder
                                    });

                                console.log(
                                    `[SO STATUS] READ recalculation: ` +
                                    `${salesOrder.hpSalesOrder} -> ${headerStatus}`
                                );
                            }
                        }
                    )
                );
            }
        );


        // =====================================================================
        // HELPER - CHECK WHETHER VALUE ACTUALLY CHANGED
        // =====================================================================

        function isDifferent(
            oldValue,
            newValue
        ) {

            if (
                oldValue === null ||
                oldValue === undefined
            ) {

                return (
                    newValue !== null &&
                    newValue !== undefined
                );
            }

            if (
                newValue === null ||
                newValue === undefined
            ) {

                return true;
            }

            return (
                String(oldValue) !==
                String(newValue)
            );
        }


        // =====================================================================
        // HELPER - GET ACTUAL CHANGED EDITABLE FIELDS
        // =====================================================================

        function getChangedFields(
            oldData,
            newData,
            entityName
        ) {

            const mapping =
                FIELD_PROCESSING_FLAGS[
                entityName
                ] || {};

            const changedFields = [];

            for (
                const field
                of Object.keys(mapping)
            ) {

                if (
                    !Object.prototype.hasOwnProperty.call(
                        newData,
                        field
                    )
                ) {

                    continue;
                }

                if (
                    isDifferent(
                        oldData[field],
                        newData[field]
                    )
                ) {

                    changedFields.push(
                        field
                    );
                }
            }

            return changedFields;
        }


        // =====================================================================
        // HELPER - SET FIELD-LEVEL PROCESSING INDICATORS
        // =====================================================================

        function setProcessingFlags(
            data,
            entityName,
            changedFields
        ) {

            const mapping =
                FIELD_PROCESSING_FLAGS[
                entityName
                ] || {};

            for (
                const field
                of changedFields
            ) {

                const processingFlag =
                    mapping[field];

                if (processingFlag) {

                    data[processingFlag] =
                        true;
                }
            }
        }


        // =====================================================================
        // HELPER - CLEAR FIELD-LEVEL PROCESSING INDICATORS
        // =====================================================================

        function clearProcessingFlags(
            data,
            entityName,
            acknowledgedFields
        ) {

            const mapping =
                FIELD_PROCESSING_FLAGS[
                entityName
                ] || {};

            for (
                const field
                of acknowledgedFields
            ) {

                const processingFlag =
                    mapping[field];

                if (processingFlag) {

                    data[processingFlag] =
                        false;
                }
            }
        }


        // =====================================================================
        // UPDATE SALES ORDER HEADER
        // =====================================================================

        srv.on(
            "updateSalesOrderHeader",
            async (req) => {

                const {
                    hpSalesOrder,
                    hpNotesToCustomer
                } = req.data;

                if (!hpSalesOrder) {

                    return req.reject(
                        400,
                        "Sales Order is required"
                    );
                }

                const oExisting =
                    await SELECT.one
                        .from(SalesOrders)
                        .where({
                            hpSalesOrder
                        });

                if (!oExisting) {

                    return req.reject(
                        404,
                        `Sales Order ${hpSalesOrder} not found`
                    );
                }

                if (
                    hpNotesToCustomer ===
                    undefined
                ) {

                    return req.reject(
                        400,
                        "No editable fields supplied"
                    );
                }

                const changedFields =
                    getChangedFields(
                        oExisting,
                        req.data,
                        "SalesOrders"
                    );

                if (
                    changedFields.length === 0
                ) {

                    return req.reject(
                        400,
                        "No changes detected"
                    );
                }

                const oUpdate = {

                    hpNotesToCustomer:
                        hpNotesToCustomer
                };

                setProcessingFlags(
                    oUpdate,
                    "SalesOrders",
                    changedFields
                );

                oUpdate.simpleChangeProcessingInd =
                    true;

                await UPDATE(SalesOrders)
                    .set(oUpdate)
                    .where({
                        hpSalesOrder
                    });

                return {

                    hpSalesOrder,

                    lineId: "",

                    status: "",

                    ordchgTriggered:
                        false,

                    message:
                        "Sales Order header updated successfully"
                };
            }
        );


        // =====================================================================
        // EXPOSE EDITABLE FIELDS TO UI
        // =====================================================================

        srv.on(
            "getEditableFields",
            async (req) => {

                const {
                    entityName
                } = req.data;

                if (
                    entityName &&
                    EDITABLE_FIELDS[
                    entityName
                    ]
                ) {

                    return [
                        {
                            entity:
                                entityName,

                            fields:
                                EDITABLE_FIELDS[
                                entityName
                                ]
                        }
                    ];
                }

                return Object.entries(
                    EDITABLE_FIELDS
                ).map(
                    ([entity, fields]) => ({

                        entity,

                        fields
                    })
                );
            }
        );


        // =====================================================================
        // FIELD-LEVEL ENFORCEMENT
        // =====================================================================

        srv.before(
            "UPDATE",
            SalesOrders,
            (req) =>
                enforceEditableFields(
                    req,
                    EDITABLE_FIELDS.SalesOrders
                )
        );


        srv.before(
            "UPDATE",
            SalesOrderItems,
            (req) =>
                enforceEditableFields(
                    req,
                    EDITABLE_FIELDS.SalesOrderItems
                )
        );


        function enforceEditableFields(
            req,
            allowedFields
        ) {

            const keyFields =
                Object.keys(
                    req.target.keys || {}
                );

            const managedFields = [
                "createdAt",
                "createdBy",
                "modifiedAt",
                "modifiedBy"
            ];

            const rejected = [];

            Object.keys(req.data)
                .forEach(
                    (field) => {

                        if (
                            keyFields.includes(
                                field
                            ) ||
                            managedFields.includes(
                                field
                            )
                        ) {

                            return;
                        }

                        if (
                            !allowedFields.includes(
                                field
                            )
                        ) {

                            rejected.push(
                                field
                            );

                            delete req.data[field];
                        }
                    }
                );

            if (rejected.length) {

                req.reject(
                    403,
                    `Field(s) not editable in Phase 1 MVP: ${rejected.join(", ")}`
                );
            }
        }


        // =====================================================================
        // BUSINESS RULE - BLOCK CANCELLED LINE UPDATE
        // =====================================================================

        srv.before(
            "UPDATE",
            SalesOrderItems,
            blockCancelledLineUpdate
        );


        async function blockCancelledLineUpdate(
            req
        ) {

            const {
                salesOrder_hpSalesOrder,
                lineId
            } = req.data;

            if (
                !salesOrder_hpSalesOrder ||
                !lineId
            ) {

                return;
            }

            const existing =
                await SELECT.one
                    .from(SalesOrderItems)
                    .where({
                        salesOrder_hpSalesOrder,
                        lineId
                    })
                    .columns(
                        "lineStatus_code"
                    );

            if (
                existing?.lineStatus_code ===
                CANCELLED_LINE_STATUS_CODE
            ) {

                req.reject(
                    400,
                    "Cannot update a cancelled line item"
                );
            }
        }


        // =====================================================================
        // BUSINESS RULE - PRICING VALIDATION
        // =====================================================================

        srv.before(
            "UPDATE",
            SalesOrderItems,
            enforcePricingRules
        );


        function enforcePricingRules(
            req
        ) {

            const {
                salesPrice,
                salesPriceUnit,
                specialDealFlagSo
            } = req.data;

            if (
                salesPrice !== undefined
            ) {

                if (
                    specialDealFlagSo !== true
                ) {

                    req.reject(
                        400,
                        "Special Deal Flag must be set to Y before updating Sales Price"
                    );
                }

                if (
                    !salesPriceUnit
                ) {

                    req.reject(
                        400,
                        "Sales Price Unit is mandatory when Sales Price is updated"
                    );
                }
            }

            if (
                specialDealFlagSo === true &&
                !salesPrice
            ) {

                req.reject(
                    400,
                    "Sales Price cannot be blank once Special Deal Flag is set to Y"
                );
            }
        }


        // =====================================================================
        // GET USER INFO
        // =====================================================================

       srv.on("getUserInfo", async req => {

    const scope =
        await loadUserScope(req);

    return {
        isHpBuyer:
            req.user.is("SalesOrderManage"),

        isViewer:
            req.user.is("SalesOrderViewer"),

        isCustomerUser:
            !!scope.customerUser,

        visibleFilters:
            getVisibleFilters(scope) || []
    };
});


        // =====================================================================
        // UPDATE SALES ORDER ITEM
        // =====================================================================

        srv.on(
            "updateSalesOrderItem",
            async (req) => {

                const {
                    salesOrder,
                    lineID,
                    salesPrice,
                    salesPriceUnit,
                    specialDealFlagSo,
                    hpNotesToCustomer,
                    hpBacklogNotes
                } = req.data;

                if (!salesOrder) {

                    return req.reject(
                        400,
                        "Sales Order is required"
                    );
                }

                if (!lineID) {

                    return req.reject(
                        400,
                        "Line ID is required"
                    );
                }

                const oExisting =
                    await SELECT.one
                        .from(SalesOrderItems)
                        .where({

                            salesOrder_hpSalesOrder:
                                salesOrder,

                            lineId:
                                lineID
                        });

                if (!oExisting) {

                    return req.reject(
                        404,
                        `Sales Order ${salesOrder}, Line ${lineID} not found`
                    );
                }

                if (
                    oExisting.lineStatus_code ===
                    CANCELLED_LINE_STATUS_CODE
                ) {

                    return req.reject(
                        400,
                        "Cannot update a cancelled line item"
                    );
                }

                const oUpdate = {};


                if (
                    salesPrice !== undefined
                ) {

                    oUpdate.salesPrice =
                        salesPrice;
                }


                if (
                    salesPriceUnit !== undefined
                ) {

                    oUpdate.salesPriceUnit =
                        salesPriceUnit;
                }


                if (
                    specialDealFlagSo !== undefined
                ) {

                    oUpdate.specialDealFlagSo =
                        specialDealFlagSo;
                }


                if (
                    hpNotesToCustomer !== undefined
                ) {

                    oUpdate.hpNotesToCustomer =
                        hpNotesToCustomer;
                }


                if (
                    hpBacklogNotes !== undefined
                ) {

                    oUpdate.hpBacklogNotes =
                        hpBacklogNotes;
                }


                if (
                    Object.keys(oUpdate).length ===
                    0
                ) {

                    return req.reject(
                        400,
                        "No editable fields supplied"
                    );
                }


                // -------------------------------------------------------------
                // Business Rules
                // -------------------------------------------------------------

                if (
                    salesPrice !== undefined
                ) {

                    if (
                        specialDealFlagSo !== true &&
                        oExisting.specialDealFlagSo !== true
                    ) {

                        return req.reject(
                            400,
                            "Special Deal Flag must be set to Yes before updating Sales Price"
                        );
                    }


                    const vPriceUnit =
                        salesPriceUnit !== undefined
                            ? salesPriceUnit
                            : oExisting.salesPriceUnit;


                    if (
                        vPriceUnit === undefined ||
                        vPriceUnit === null ||
                        vPriceUnit === ""
                    ) {

                        return req.reject(
                            400,
                            "Sales Price Unit is mandatory when Sales Price is updated"
                        );
                    }
                }


                // -------------------------------------------------------------
                // Special Deal Flag = Yes requires Sales Price
                // -------------------------------------------------------------

                if (
                    specialDealFlagSo === true
                ) {

                    const vPrice =
                        salesPrice !== undefined
                            ? salesPrice
                            : oExisting.salesPrice;


                    if (
                        vPrice === undefined ||
                        vPrice === null
                    ) {

                        return req.reject(
                            400,
                            "Sales Price cannot be blank when Special Deal Flag is Yes"
                        );
                    }
                }


                // -------------------------------------------------------------
                // Detect actual changed fields
                // -------------------------------------------------------------

                const changedFields =
                    getChangedFields(
                        oExisting,
                        oUpdate,
                        "SalesOrderItems"
                    );


                if (
                    changedFields.length === 0
                ) {

                    return req.reject(
                        400,
                        "No changes detected"
                    );
                }


                setProcessingFlags(
                    oUpdate,
                    "SalesOrderItems",
                    changedFields
                );


                // -------------------------------------------------------------
                // Determine whether ORDCHG is required
                // -------------------------------------------------------------

                const ordchgFields = [

                    "salesPrice",

                    "salesPriceUnit",

                    "specialDealFlagSo",

                    "hpNotesToCustomer",

                    "reasonForCancellation_code"
                ];


                const requiresOrdchg =
                    changedFields.some(
                        field =>
                            ordchgFields.includes(
                                field
                            )
                    );


                if (
                    requiresOrdchg
                ) {

                    oUpdate.simpleChangeProcessingInd =
                        true;
                }


                // -------------------------------------------------------------
                // BTP-only Backlog Notes
                // -------------------------------------------------------------

                const backlogNotesChanged =
                    changedFields.includes(
                        "hpBacklogNotes"
                    );


                // -------------------------------------------------------------
                // UPDATE DATABASE
                // -------------------------------------------------------------

                await UPDATE(SalesOrderItems)
                    .set(oUpdate)
                    .where({

                        salesOrder_hpSalesOrder:
                            salesOrder,

                        lineId:
                            lineID
                    });


                // -------------------------------------------------------------
                // Clear BTP-only processing indicator
                // -------------------------------------------------------------

                if (
                    backlogNotesChanged
                ) {

                    await UPDATE(SalesOrderItems)
                        .set({

                            hpBacklogNotesProcessingInd:
                                false
                        })
                        .where({

                            salesOrder_hpSalesOrder:
                                salesOrder,

                            lineId:
                                lineID
                        });
                }


                return {

                    hpSalesOrder:
                        salesOrder,

                    lineId:
                        lineID,

                    status:
                        oExisting.lineStatus_code ||
                        "",

                    ordchgTriggered:
                        false,

                    message:
                        "Sales Order item updated successfully"
                };
            }
        );


        // =====================================================================
        // CANCEL SALES ORDER LINE
        // =====================================================================

        srv.on(
            "cancelLine",
            "SalesOrderItems",
            async (req) => {

                const key =
                    req.params[0] || {};

                const salesOrder_hpSalesOrder =
                    key.salesOrder_hpSalesOrder;

                const lineId =
                    key.lineId;

                const {
                    reasonForCancellation
                } = req.data;


                // -------------------------------------------------------------
                // Validate keys
                // -------------------------------------------------------------

                if (
                    !salesOrder_hpSalesOrder ||
                    !lineId
                ) {

                    return req.reject(
                        400,
                        "Sales Order and Line ID are required"
                    );
                }


                // -------------------------------------------------------------
                // Find existing line
                // -------------------------------------------------------------

                const oExisting =
                    await SELECT.one
                        .from(SalesOrderItems)
                        .where({
                            salesOrder_hpSalesOrder,
                            lineId
                        });


                if (!oExisting) {

                    return req.reject(
                        404,
                        `Sales Order ${salesOrder_hpSalesOrder}, Line ${lineId} not found`
                    );
                }


                // -------------------------------------------------------------
                // Already cancelled
                // -------------------------------------------------------------

                if (
                    oExisting.lineStatus_code ===
                    CANCELLED_LINE_STATUS_CODE
                ) {

                    return req.reject(
                        400,
                        "Line item is already cancelled"
                    );
                }


                // -------------------------------------------------------------
                // Validate cancellable status
                // -------------------------------------------------------------

                if (
                    !CANCELLABLE_LINE_STATUS_CODES.includes(
                        oExisting.lineStatus_code
                    )
                ) {

                    return req.reject(
                        400,
                        `Line item cannot be cancelled from status '${oExisting.lineStatus_code}'. ` +
                        `Cancellable statuses: ${CANCELLABLE_LINE_STATUS_CODES.join(", ")}`
                    );
                }


                // -------------------------------------------------------------
                // Validate cancellation reason
                // -------------------------------------------------------------

                const oReason =
                    await SELECT.one
                        .from(
                            "HpBuySellOtcSalesOrderService.CancellationReasons"
                        )
                        .where({
                            code:
                                reasonForCancellation
                        });


                if (!oReason) {

                    return req.reject(
                        400,
                        `Invalid cancellation reason code '${reasonForCancellation}'`
                    );
                }


                // -------------------------------------------------------------
                // Update cancellation
                // -------------------------------------------------------------

                await UPDATE(SalesOrderItems)
                    .set({

                        lineStatus_code:
                            CANCELLED_LINE_STATUS_CODE,

                        reasonForCancellation_code:
                            reasonForCancellation,

                        reasonForCancellationProcessingInd:
                            true,

                        simpleChangeProcessingInd:
                            true
                    })
                    .where({
                        salesOrder_hpSalesOrder,
                        lineId
                    });


                // -------------------------------------------------------------
                // Recalculate Header Sales Order Status
                // -------------------------------------------------------------

                const headerStatus =
                    await updateHeaderSalesOrderStatus(
                        salesOrder_hpSalesOrder,
                        SalesOrders,
                        SalesOrderItems
                    );


                console.log(
                    `[SO STATUS] After cancellation: ` +
                    `${salesOrder_hpSalesOrder} -> ${headerStatus}`
                );


                // -------------------------------------------------------------
                // Build ORDCHG payload
                // -------------------------------------------------------------

                const ordchgPayload =
                    buildCancelLineOrdchgPayload({

                        hpSalesOrder:
                            salesOrder_hpSalesOrder,

                        lineId,

                        reasonCode:
                            reasonForCancellation,

                        userId:
                            req.user.id
                    });


                // -------------------------------------------------------------
                // Current integration behaviour
                // -------------------------------------------------------------

                console.log(
                    "[ORDCHG] cancelLine payload " +
                    "(not sent - CPI integration out of scope):",
                    ordchgPayload
                );


                // -------------------------------------------------------------
                // Return result
                // -------------------------------------------------------------

                return {

                    hpSalesOrder:
                        salesOrder_hpSalesOrder,

                    lineId,

                    status:
                        CANCELLED_LINE_STATUS_CODE,

                    headerStatus:
                        headerStatus || "",

                    ordchgTriggered:
                        false,

                    message:
                        "Line item cancelled successfully"
                };
            }
        );


        // =====================================================================
        // MDM DESCRIPTION + PROJECT DETAIL RESOLUTION
        // =====================================================================
        //
        // Description mappings:
        //
        // wbsProjectCode
        //      -> MDM ProjectVH.wbselement
        //      -> wbsProjectCodeDescription
        //
        // hpCompanyCode
        //      -> MDM CompanyCode.companycode
        //      -> hpCompanyDescription
        //
        // customerCode
        //      -> MDM Customer.customerid
        //      -> customerDescription
        //
        // hpBuyerCode
        //      -> MDM Buyer.searchterm1
        //      -> hpBuyerName
        //
        // Project details:
        //
        // wbsProjectCode
        //      -> MDM Project.wbsElement
        //
        // customerNumber
        //      -> contractNumber
        //
        // documentDate
        //      -> contractDate
        //
        // businessModel
        //      -> businessModel
        //
        // termsOfPayment
        //      -> paymentTerms
        //
        // transitTime
        //      -> item.transitTime
        //
        // =====================================================================

        srv.after(
            "READ",
            SalesOrders,
            async (rows) => {

                if (!rows) {
                    return;
                }

                // Resolve descriptions:
                // PROJECT
                // COMPANY_CODE
                // CUSTOMER
                // BUYER
                await resolveDescriptions(
                    rows,
                    MDM_DESCRIPTIONS.SalesOrder,
                    { fill: true }
                );

                // Resolve project details:
                // customerNumber
                // documentDate
                // businessModel
                // termsOfPayment
                // transitTime
                await resolveProjectDetails(
                    rows
                );
            }
        );


        // =====================================================================
        // UPSERT (create-or-update) for CPI / external integration
        // =====================================================================
        //
        // CPI addresses this service with POST alone: there is no "does the
        // Sales Order exist yet" call first, and no PUT/PATCH afterwards. So a
        // write is resolved here - the same architecture used in the Purchase
        // Order service's srv.js - rather than at the sender:
        //
        //     record does NOT exist (by primary key)  ->  INSERT
        //     record already EXISTS                   ->  UPDATE in place
        //
        // The same handler is registered on UPDATE too, so a sender that uses
        // PUT/PATCH gets the same answer instead of a 404 on a record that has
        // not arrived yet. Either verb is safe to repeat.
        //
        // Three shapes reach it:
        //
        //     one row                { "hpSalesOrder": "5000000010", ... }
        //     several rows           [ { ... }, { ... } ]
        //     a document with lines  { "hpSalesOrder": "...", "items": [...] }
        //
        // A deep payload is split rather than written as one: replacing the
        // "items" composition (or the "acknowledgements" composition) would
        // delete every row the sender happened not to include in this
        // message, which is wrong for a partial change message from an ERP.
        //
        // Bypassed handlers, and why they are re-applied here explicitly:
        //
        // assertBuyer (registered on CREATE/UPDATE by registerUserScope) runs
        // ahead of this handler in the normal before-phase, so row-level
        // authorization is unaffected. But enforcePricingRules and
        // blockCancelledLineUpdate are registered on UPDATE only - a sender
        // that POSTs to resolve an already-existing record never raises the
        // UPDATE event those are attached to - so both are re-applied inline
        // below, in applyItemUpdateBusinessRules, wherever the key already
        // exists. EDITABLE_FIELDS is deliberately NOT re-applied here: it
        // restricts what a human buyer may PATCH from the Fiori UI in Phase 1
        // MVP, not what the inbound ERP/CPI feed may populate - most of the
        // fields it excludes (dates, quantities, part numbers, ship-to) are
        // exactly the fields this integration exists to synchronize.
        //
        // SalesOrderAcknowledgements (the ORDRSP PDF) is upserted the same
        // way PurchaseOrderAttachment is in the Purchase Order service: keyed
        // on (salesOrder, ackType, version) rather than a generated id, so
        // CPI can POST a confirmation or cancellation PDF by key, without a
        // GET first, the same way it posts a header or an item.
        // =====================================================================

        /**
         * The key elements of an entity as stored: flattened association
         * foreign keys included, the association itself and CAP's draft key
         * left out.
         */
        function keyElementsOf(entity) {
            return Object.keys(entity.elements).filter((name) => {
                const element = entity.elements[name];

                return element && element.key &&
                    !element.isAssociation && !element.virtual &&
                    name !== "IsActiveEntity";
            });
        }

        /**
         * Flattens a key association sent as a nested object onto the
         * foreign key column CAP actually stores, e.g.
         *
         *     { "salesOrder": { "hpSalesOrder": "5000000010" } }
         *
         * becomes
         *
         *     { "salesOrder_hpSalesOrder": "5000000010" }
         *
         * Senders may write either shape; neither should have to know which
         * one this service stores.
         */
        function flattenKeyAssociations(entity, row) {
            for (const name of Object.keys(entity.elements)) {
                const element = entity.elements[name];

                if (!element || !element.isAssociation || !element.key) continue;

                const nested = row[name];
                if (!nested || typeof nested !== "object") continue;

                for (const target of Object.keys(nested)) {
                    const flattened = name + "_" + target;

                    if (row[flattened] === undefined) row[flattened] = nested[target];
                }

                delete row[name];
            }
        }

        /** The entity's own name, without the service prefix. */
        function shortName(entity) {
            return String(entity.name).split(".").pop();
        }

        /**
         * The compositions each entity owns, and the parent key that
         * identifies a child as belonging to this parent. A child arriving
         * inside its header does not have to repeat that key - it is filled
         * in from the parent before the child is written.
         */
        const CHILD_COMPOSITIONS = {
            SalesOrders: [
                {
                    property: "items",
                    target: () => SalesOrderItems,
                    parentKeys: { salesOrder_hpSalesOrder: "hpSalesOrder" }
                },
                {
                    property: "acknowledgements",
                    target: () => SalesOrderAcknowledgements,
                    parentKeys: { salesOrder_hpSalesOrder: "hpSalesOrder" }
                }
            ]
        };

        /** Item fields whose change requires the ORDCHG simple-change flag - same list as updateSalesOrderItem. */
        const ITEM_ORDCHG_FIELDS = [
            "salesPrice",
            "salesPriceUnit",
            "specialDealFlagSo",
            "hpNotesToCustomer",
            "reasonForCancellation_code"
        ];

        /**
         * The business rules that normally run only on UPDATE - the cancelled
         * line guard and the special-deal pricing rule - re-applied here
         * because a CPI POST that resolves to an update never raises the
         * UPDATE event those handlers are registered on.
         *
         * Measured against the stored line, the same way updateSalesOrderItem
         * measures it: a field the sender left out falls back to what is
         * already on file, so a message that changes only the notes does not
         * have to repeat the price and unit for this check to pass.
         *
         * @param {object} req the request, for the rejection
         * @param {object} existing the line as stored
         * @param {object} row the incoming payload for this line
         */
        function applyItemUpdateBusinessRules(req, existing, row) {
            if (existing.lineStatus_code === CANCELLED_LINE_STATUS_CODE) {
                return req.reject(400, "Cannot update a cancelled line item");
            }

            if (row.salesPrice !== undefined) {
                const effectiveSpecialDealFlag =
                    row.specialDealFlagSo !== undefined
                        ? row.specialDealFlagSo
                        : existing.specialDealFlagSo;

                if (effectiveSpecialDealFlag !== true) {
                    return req.reject(
                        400,
                        "Special Deal Flag must be set to Yes before updating Sales Price"
                    );
                }

                const effectivePriceUnit =
                    row.salesPriceUnit !== undefined
                        ? row.salesPriceUnit
                        : existing.salesPriceUnit;

                if (
                    effectivePriceUnit === undefined ||
                    effectivePriceUnit === null ||
                    effectivePriceUnit === ""
                ) {
                    return req.reject(
                        400,
                        "Sales Price Unit is mandatory when Sales Price is updated"
                    );
                }
            }

            if (row.specialDealFlagSo === true) {
                const effectivePrice =
                    row.salesPrice !== undefined
                        ? row.salesPrice
                        : existing.salesPrice;

                if (effectivePrice === undefined || effectivePrice === null) {
                    return req.reject(
                        400,
                        "Sales Price cannot be blank when Special Deal Flag is Yes"
                    );
                }
            }
        }

        /**
         * Writes one row: created when its key is not on file, updated in
         * place when it is, and its children resolved the same way after.
         *
         * @param {object} req the request, for the rejection on a missing key
         * @param {object} entity CSN entity definition
         * @param {object} row the payload for this row
         * @returns {Promise<{created: number, updated: number}>} what the
         *          write did, this row and everything beneath it counted
         *          together
         */
        async function upsertRow(req, entity, row) {
            if (!row || typeof row !== "object") return { created: 0, updated: 0 };

            flattenKeyAssociations(entity, row);

            // Children travel separately: writing them with the parent would
            // replace the composition rather than upsert into it
            const children = CHILD_COMPOSITIONS[shortName(entity)] || [];
            const pending = [];

            for (const child of children) {
                const childRows = toArray(row[child.property]);

                if (childRows.length) pending.push({ child, rows: childRows });

                delete row[child.property];
            }

            const where = {};

            for (const name of keyElementsOf(entity)) {
                const value = row[name];

                if (value === undefined || value === null || value === "") {
                    return req.reject(
                        400,
                        `Key field "${name}" is required for upsert on ${shortName(entity)}`
                    );
                }

                where[name] = value;
            }

            const existing = await SELECT.one.from(entity).where(where);
            const result = { created: 0, updated: 0 };

            if (existing) {
                if (shortName(entity) === "SalesOrderItems") {
                    applyItemUpdateBusinessRules(req, existing, row);

                    const changedFields = getChangedFields(existing, row, "SalesOrderItems");

                    setProcessingFlags(row, "SalesOrderItems", changedFields);

                    if (changedFields.some((field) => ITEM_ORDCHG_FIELDS.includes(field))) {
                        row.simpleChangeProcessingInd = true;
                    }
                }

                if (shortName(entity) === "SalesOrders") {
                    const changedFields = getChangedFields(existing, row, "SalesOrders");

                    setProcessingFlags(row, "SalesOrders", changedFields);

                    if (changedFields.length) row.simpleChangeProcessingInd = true;
                }

                // Only the elements the message carried: a sender that leaves
                // a field out is not asking for it to be cleared
                await UPDATE(entity).set(row).where(where);
                result.updated += 1;
            } else {
                await INSERT.into(entity).entries(row);
                result.created += 1;
            }

            for (const entry of pending) {
                const target = entry.child.target();

                for (const childRow of entry.rows) {
                    if (!childRow || typeof childRow !== "object") continue;

                    // Fill the parent key in from the parent, where the child
                    // left it out
                    for (const [childKey, parentKey] of Object.entries(entry.child.parentKeys)) {
                        if (childRow[childKey] === undefined || childRow[childKey] === null) {
                            childRow[childKey] = where[parentKey] !== undefined
                                ? where[parentKey]
                                : row[parentKey];
                        }
                    }

                    const childResult = await upsertRow(req, target, childRow);

                    result.created += childResult.created;
                    result.updated += childResult.updated;
                }
            }

            return result;
        }

        /**
         * The keys the request was addressed to, as they appear in the URL.
         * A POST carries the whole record in its body, but a PATCH names the
         * record in its path and sends only the elements it is changing - so
         * on that route the key is in req.params and nowhere else.
         *
         * @param {object} req the request
         * @returns {object} key values, empty when the request addresses a
         *          collection
         */
        function addressedKeys(req) {
            const keys = {};

            for (const param of toArray(req.params)) {
                if (!param || typeof param !== "object") continue;
                Object.assign(keys, param);
            }

            return keys;
        }

        /**
         * Rolls the header Sales Order Status up for every document a write
         * touched. Idempotent - the status is derived from the lines each
         * time - which is what makes it safe to call even though the after
         * READ handler above may also recalculate the same document once it
         * is next read.
         *
         * Direct CQL writes inside upsertRow bypass the service layer, so the
         * after-READ recalculation is the only other place this would happen
         * - and only on the next read of the document, not at write time.
         * Running it here means a document created with its items in one
         * message carries the correct status immediately.
         */
        async function rollUpWrittenOrders(entity, rows) {
            const name = shortName(entity);

            if (name !== "SalesOrders" && name !== "SalesOrderItems") return;

            const salesOrderNumbers = new Set();

            for (const row of rows) {
                if (!row) continue;

                const salesOrderNumber = name === "SalesOrders"
                    ? row.hpSalesOrder
                    : row.salesOrder_hpSalesOrder;

                if (salesOrderNumber) salesOrderNumbers.add(salesOrderNumber);
            }

            for (const salesOrderNumber of salesOrderNumbers) {
                try {
                    await updateHeaderSalesOrderStatus(
                        salesOrderNumber,
                        SalesOrders,
                        SalesOrderItems
                    );
                } catch (error) {
                    // A write that succeeded must not be failed by the roll
                    // up after it
                    console.warn(
                        `Header status roll up for ${salesOrderNumber} skipped:`,
                        error.message
                    );
                }
            }
        }

        /**
         * CREATE / UPDATE handler for an entity that is written by message.
         *
         * @param {object} entity CSN entity definition
         * @returns {Function} CAP request handler
         */
        const upsert = (entity) => async (req) => {
            const bulk = Array.isArray(req.data);
            const rows = bulk ? req.data : [req.data];
            const addressed = addressedKeys(req);

            // The URL wins over the body: a PATCH that names one record and
            // carries the key of another in its payload is addressing the
            // record it named
            for (const row of rows) {
                if (!row || typeof row !== "object") continue;

                flattenKeyAssociations(entity, row);

                for (const [name, value] of Object.entries(addressed)) {
                    if (value !== undefined && value !== null) row[name] = value;
                }
            }

            const totals = { created: 0, updated: 0 };

            for (const row of rows) {
                const result = await upsertRow(req, entity, row);

                // A rejected row has already ended the request; nothing
                // comes back
                if (!result) return;

                totals.created += result.created;
                totals.updated += result.updated;
            }

            // Lines written through upsertRow use plain CQL, not the service,
            // so the after-READ recalculation never sees them until the
            // document is next read - bring the header status in line now
            await rollUpWrittenOrders(entity, rows);

            req.info(
                totals.created ? 201 : 200,
                `${shortName(entity)}: ${totals.created} record(s) created, ` +
                `${totals.updated} record(s) updated`
            );

            // The persisted representation, read back so the sender sees what
            // was stored rather than what it sent - the derived status and
            // processing flags included
            const persisted = [];

            for (const row of rows) {
                const where = {};
                let complete = true;

                for (const name of keyElementsOf(entity)) {
                    if (row[name] === undefined || row[name] === null) {
                        complete = false;
                        break;
                    }

                    where[name] = row[name];
                }

                if (complete) persisted.push(await SELECT.one.from(entity).where(where));
            }

            return bulk ? persisted : persisted[0];
        };

        srv.on("CREATE", SalesOrders, upsert(SalesOrders));
        srv.on("CREATE", SalesOrderItems, upsert(SalesOrderItems));
        srv.on("CREATE", SalesOrderAcknowledgements, upsert(SalesOrderAcknowledgements));

        // The same resolution for a sender that uses PUT or PATCH: a record
        // that is not on file yet is created rather than answered with a 404
        srv.on("UPDATE", SalesOrders, upsert(SalesOrders));
        srv.on("UPDATE", SalesOrderItems, upsert(SalesOrderItems));
        srv.on("UPDATE", SalesOrderAcknowledgements, upsert(SalesOrderAcknowledgements));

        /**
         * hasContent for the acknowledgement list - the same computation
         * PurchaseOrderAttachment.hasContent uses: an "is not null" over the
         * keys of the page, so the PDF blob itself is never selected just to
         * answer whether one is on file.
         */
        srv.after("READ", SalesOrderAcknowledgements, async (results) => {
            if (!results) return;

            const rows = toArray(results).filter((row) => row && row.ackType);
            if (!rows.length) return;

            const salesOrderNumbers = [...new Set(
                rows.map((row) => row.salesOrder_hpSalesOrder).filter(Boolean)
            )];

            const stored = salesOrderNumbers.length
                ? await SELECT.from(SalesOrderAcknowledgements)
                    .columns("salesOrder_hpSalesOrder", "ackType", "version")
                    .where({
                        salesOrder_hpSalesOrder: { in: salesOrderNumbers },
                        content: { "!=": null }
                    })
                : [];

            const ackKey = (row) => [
                row.salesOrder_hpSalesOrder, row.ackType, row.version
            ].join("|");

            const withContent = new Set(stored.map(ackKey));

            for (const row of rows) row.hasContent = withContent.has(ackKey(row));
        });
    }
);