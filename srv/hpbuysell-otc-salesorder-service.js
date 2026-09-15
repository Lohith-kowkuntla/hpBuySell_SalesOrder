//---------------------------------------------------------------------------------*
// Confidential and Proprietary
// Copyright 2026, HP
// All Rights Reserved
//---------------------------------------------------------------------------------*
// Application Name : Sales Order
// Module           : Service
// Namespace        : hpbuysell.otc.salesorder
//---------------------------------------------------------------------------------*

const cds = require("@sap/cds");

const { buildCancelLineOrdchgPayload } =
    require("./integration/ordchg");


const {
    MDM_SERVICE_NAME,
    MAPPINGS: MDM_DESCRIPTIONS,
    resolveDescriptions
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
//
// true  = field change is currently being processed
// false = field change has been acknowledged/completed
//
// IMPORTANT:
// These fields are NOT included in EDITABLE_FIELDS because they are
// system-controlled fields.
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


const { SELECT, UPDATE } = cds.ql;


// ============================================================================
// HEADER SALES ORDER STATUS PRIORITY - FDS 7.6
// ============================================================================
//
// Header Sales Order Status is derived from ALL line item statuses.
//
// FDS order:
//
//   1  Open
//   2  Awaiting Acknowledgement
//   3  Confirmed
//   4  Change Processing
//   5  Partially Shipped
//   6  Shipped
//   7  Delivered
//   8  Invoiced
//   9  Cancelled
//
// IMPORTANT:
// Do NOT use LineStatuses.priority for this calculation.
//
// The current CSV contains:
//
// AACK, OPEN, CONF, CHPR, PSHP, SHIP, DLVD, INVD, CANC
//
// There is NO PEND/Pending Cancellation code in the current CSV.
// Therefore PEND is intentionally NOT included here.
// ============================================================================

const HEADER_STATUS_PRIORITY = [

    "OPEN",   // Priority 1 - Open
    "AACK",   // Priority 2 - Awaiting Acknowledgement
    "CONF",   // Priority 3 - Confirmed
    "CHPR",   // Priority 4 - Change Processing
    "PSHP",   // Priority 5 - Partially Shipped
    "SHIP",   // Priority 6 - Shipped
    "DLVD",   // Priority 7 - Delivered
    "INVD",   // Priority 8 - Invoiced
    "CANC"    // Priority 9 - Cancelled
];


// ============================================================================
// DERIVE HEADER SALES ORDER STATUS
// ============================================================================
//
// Reads ALL line statuses for a Sales Order.
//
// Example:
//
//   Line 10 -> CONF
//   Line 20 -> OPEN
//   Line 30 -> CANC
//
// Header -> OPEN
//
// because OPEN has the highest FDS header priority.
//
// ============================================================================

async function deriveHeaderSalesOrderStatus(
    salesOrderId,
    SalesOrderItems
) {

    if (!salesOrderId) {
        return null;
    }


    // ------------------------------------------------------------------------
    // Read all line statuses belonging to this Sales Order
    // ------------------------------------------------------------------------

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


    // ------------------------------------------------------------------------
    // No line items
    // ------------------------------------------------------------------------

    if (!lineItems.length) {

        return null;
    }


    // ------------------------------------------------------------------------
    // Get unique line status codes
    // ------------------------------------------------------------------------

    const lineStatusCodes =
        new Set(
            lineItems
                .map(
                    item =>
                        item.lineStatus_code
                )
                .filter(Boolean)
        );


    // ------------------------------------------------------------------------
    // Apply FDS priority
    //
    // The first status found wins.
    // ------------------------------------------------------------------------

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


    // ------------------------------------------------------------------------
    // No recognized status
    // ------------------------------------------------------------------------

    return null;
}


// ============================================================================
// UPDATE DERIVED HEADER SALES ORDER STATUS
// ============================================================================
//
// Updates:
//
// SalesOrders.salesOrderStatus_code
//
// based on:
//
// SalesOrderItems.lineStatus_code
//
// ============================================================================

async function updateHeaderSalesOrderStatus(
    salesOrderId,
    SalesOrders,
    SalesOrderItems
) {

    if (!salesOrderId) {
        return null;
    }


    // ------------------------------------------------------------------------
    // Derive header status from all lines
    // ------------------------------------------------------------------------

    const headerStatus =
        await deriveHeaderSalesOrderStatus(
            salesOrderId,
            SalesOrderItems
        );


    // ------------------------------------------------------------------------
    // No status available
    // ------------------------------------------------------------------------

    if (!headerStatus) {

        return null;
    }


    // ------------------------------------------------------------------------
    // Read current header status
    // ------------------------------------------------------------------------

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


    // ------------------------------------------------------------------------
    // Avoid unnecessary UPDATE
    // ------------------------------------------------------------------------

    if (
        existingHeader &&
        existingHeader.salesOrderStatus_code ===
        headerStatus
    ) {

        return headerStatus;
    }


    // ------------------------------------------------------------------------
    // Update Header Sales Order Status
    // ------------------------------------------------------------------------

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
            SalesOrderItems
        } = srv.entities;


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
        //
        // This is important for existing Sales Orders.
        //
        // Example:
        //
        // Existing DB data:
        //
        // Sales Order 0005000010
        //   Line 000010 -> AACK
        //   Line 000020 -> AACK
        //
        // If salesOrderStatus_code is currently NULL, this logic derives:
        //
        //   Header -> AACK
        //
        // and persists it in SalesOrders.
        //
        // =====================================================================

        srv.after(
            "READ",
            SalesOrders,
            async (data) => {

                if (!data) {
                    return;
                }


                // -------------------------------------------------------------
                // Normalize single/multiple READ result
                // -------------------------------------------------------------

                const salesOrders =
                    Array.isArray(data)
                        ? data
                        : [data];


                // -------------------------------------------------------------
                // Derive status for each Sales Order
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


                            // -------------------------------------------------
                            // Always expose calculated value to UI
                            // -------------------------------------------------

                            salesOrder.salesOrderStatus_code =
                                headerStatus;


                            // -------------------------------------------------
                            // Persist only when DB value is different
                            // -------------------------------------------------

                            if (
                                salesOrder.salesOrderStatus_code !==
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

                                return;
                            }


                            // -------------------------------------------------
                            // IMPORTANT:
                            // Since we assigned the calculated value above,
                            // the comparison above will always be equal.
                            //
                            // Therefore persistence is handled below using
                            // a separate DB read.
                            // -------------------------------------------------
                        }
                    )
                );


                // ----------------------------------------------------------------
                // Persist derived values correctly
                // ----------------------------------------------------------------
                //
                // The UI already receives the calculated value above.
                // This second pass makes sure the database is also synchronized.
                //
                // ----------------------------------------------------------------

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

        srv.on(
            "getUserInfo",
            async (req) => {

                return {

                    isHpBuyer:
                        req.user.is(
                            "SalesOrderManage"
                        ),

                    isViewer:
                        req.user.is(
                            "SalesOrderViewer"
                        )
                };
            }
        );


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

        // calling  mdmDescriptionResolver.js for field mapping

        this.after("READ", "SalesOrders", async (rows) => {
            await resolveDescriptions(
                rows,
                MDM_DESCRIPTIONS.SalesOrder
            );
        });


    }

);