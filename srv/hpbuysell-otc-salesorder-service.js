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
    registerUserScope
} = require("./utils/userScope");

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

const { SELECT, UPDATE } = cds.ql;


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
            SalesOrderItems
        } = srv.entities;


        // -------------------------------------------------------------
        // User scope authorization
        // -------------------------------------------------------------

        registerUserScope(srv);


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
            "MDM_UserProjects"
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
    }
);