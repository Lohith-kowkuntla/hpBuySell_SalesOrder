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

// EDITABLE FIELDS Logic

const EDITABLE_FIELDS = {
    SalesOrders: ["hpNotesToCustomer"],
    SalesOrderItems: [
        "salesPrice",
        "salesPriceUnit",
        "specialDealFlagSo",
        "hpNotesToCustomer",
        "hpBacklogNotes",
        "reasonForCancellation_code"
    ]
};

const CANCELLED_LINE_STATUS_CODE = "CNCL"; // confirm against your LineStatuses data

const { SELECT, UPDATE } = cds.ql;

module.exports = cds.service.impl(async function (srv) {


    const { SalesOrders, SalesOrderItems } = srv.entities;

    // =========================================================================
    // Static Value Help - Special Deal Flag
    // =========================================================================

    srv.on("READ", "VH_SpecialDealFlag", async () => {

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

    });


    // =========================================================================
    // Static Value Help - GTS Hold
    // =========================================================================

    srv.on("READ", "VH_GtsHold", async () => {

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

    });


    // =========================================================================
    // Static Value Help - Blanket Indicator
    // =========================================================================

    srv.on("READ", "VH_BlanketIndicator", async () => {

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

    });

    // =========================================================================
    // Update Sales Order Header
    // =========================================================================

    srv.on("updateSalesOrderHeader", async (req) => {

        const { hpSalesOrder, hpNotesToCustomer } = req.data;

        if (!hpSalesOrder) {
            return req.reject(400, "Sales Order is required");
        }

        const oExisting = await SELECT.one
            .from(SalesOrders)
            .where({ hpSalesOrder });

        if (!oExisting) {
            return req.reject(404, `Sales Order ${hpSalesOrder} not found`);
        }

        if (hpNotesToCustomer === undefined) {
            return req.reject(400, "No editable fields supplied");
        }

        await UPDATE(SalesOrders)
            .set({
                hpNotesToCustomer,
                simpleChangeProcessingInd: true
            })
            .where({ hpSalesOrder });

        return {
            hpSalesOrder,
            lineId: "",
            status: "",
            ordchgTriggered: false,
            message: "Sales Order header updated successfully"
        };
    });


    // NEW: expose whitelist to UI
    srv.on("getEditableFields", async (req) => {
        const { entityName } = req.data;
        if (entityName && EDITABLE_FIELDS[entityName]) {
            return [{ entity: entityName, fields: EDITABLE_FIELDS[entityName] }];
        }
        return Object.entries(EDITABLE_FIELDS).map(([entity, fields]) => ({ entity, fields }));
    });

    // NEW: field-level enforcement
    srv.before("UPDATE", SalesOrders, (req) => enforceEditableFields(req, EDITABLE_FIELDS.SalesOrders));
    srv.before("UPDATE", SalesOrderItems, (req) => enforceEditableFields(req, EDITABLE_FIELDS.SalesOrderItems));

    function enforceEditableFields(req, allowedFields) {
        const keyFields = Object.keys(req.target.keys || {});
        const managedFields = ["createdAt", "createdBy", "modifiedAt", "modifiedBy"];
        const rejected = [];

        Object.keys(req.data).forEach((field) => {
            if (keyFields.includes(field) || managedFields.includes(field)) return;
            if (!allowedFields.includes(field)) {
                rejected.push(field);
                delete req.data[field];
            }
        });

        if (rejected.length) {
            req.reject(403, `Field(s) not editable in Phase 1 MVP: ${rejected.join(", ")}`);
        }
    }

    // NEW: business rules
    srv.before("UPDATE", SalesOrderItems, blockCancelledLineUpdate);
    srv.before("UPDATE", SalesOrderItems, enforcePricingRules);
    srv.before("UPDATE", SalesOrderItems, stampSimpleChangeIndicator);
    srv.before("UPDATE", SalesOrders, stampHeaderSimpleChangeIndicator);

    async function blockCancelledLineUpdate(req) {
        const { salesOrder_hpSalesOrder, lineId } = req.data;
        if (!salesOrder_hpSalesOrder || !lineId) return;
        const existing = await SELECT.one.from(SalesOrderItems)
            .where({ salesOrder_hpSalesOrder, lineId }).columns("lineStatus_code");
        if (existing?.lineStatus_code === CANCELLED_LINE_STATUS_CODE) {
            req.reject(400, "Cannot update a cancelled line item");
        }
    }

    function enforcePricingRules(req) {
        const { salesPrice, salesPriceUnit, specialDealFlagSo } = req.data;
        if (salesPrice !== undefined) {
            if (specialDealFlagSo !== true) req.reject(400, "Special Deal Flag must be set to Y before updating Sales Price");
            if (!salesPriceUnit) req.reject(400, "Sales Price Unit is mandatory when Sales Price is updated");
        }
        if (specialDealFlagSo === true && !salesPrice) {
            req.reject(400, "Sales Price cannot be blank once Special Deal Flag is set to Y");
        }
    }

    function stampSimpleChangeIndicator(req) {
        const fields = ["salesPrice", "salesPriceUnit", "specialDealFlagSo", "hpNotesToCustomer"];
        if (fields.some((f) => req.data[f] !== undefined)) req.data.simpleChangeProcessingInd = true;
    }

    function stampHeaderSimpleChangeIndicator(req) {
        if (req.data.hpNotesToCustomer !== undefined) req.data.simpleChangeProcessingInd = true;
    }

    srv.on("getUserInfo", async (req) => {
        return {
            isHpBuyer: req.user.is("SalesOrderManage"),
            isViewer: req.user.is("SalesOrderViewer")
        };
    });

    // =========================================================================
    // Update Sales Order Item
    // =========================================================================

    srv.on("updateSalesOrderItem", async (req) => {

        const {
            salesOrder,
            lineID,
            salesPrice,
            salesPriceUnit,
            specialDealFlagSo,
            hpNotesToCustomer,
            hpBacklogNotes
        } = req.data;

        // ---------------------------------------------------------------------
        // Validate keys
        // ---------------------------------------------------------------------

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

        // ---------------------------------------------------------------------
        // Find existing line
        // ---------------------------------------------------------------------

        const oExisting =
            await SELECT.one
                .from(SalesOrderItems)
                .where({
                    salesOrder_hpSalesOrder: salesOrder,
                    lineId: lineID
                });

        if (!oExisting) {

            return req.reject(
                404,
                `Sales Order ${salesOrder}, Line ${lineID} not found`
            );
        }

        // ---------------------------------------------------------------------
        // Prevent update of cancelled line
        // ---------------------------------------------------------------------

        if (
            oExisting.lineStatus_code ===
            CANCELLED_LINE_STATUS_CODE
        ) {

            return req.reject(
                400,
                "Cannot update a cancelled line item"
            );
        }

        // ---------------------------------------------------------------------
        // Build update object
        // Only supplied fields are updated.
        // ---------------------------------------------------------------------

        const oUpdate = {};

        if (salesPrice !== undefined) {

            oUpdate.salesPrice =
                salesPrice;
        }

        if (salesPriceUnit !== undefined) {

            oUpdate.salesPriceUnit =
                salesPriceUnit;
        }

        if (specialDealFlagSo !== undefined) {

            oUpdate.specialDealFlagSo =
                specialDealFlagSo;
        }

        if (hpNotesToCustomer !== undefined) {

            oUpdate.hpNotesToCustomer =
                hpNotesToCustomer;
        }

        if (hpBacklogNotes !== undefined) {

            oUpdate.hpBacklogNotes =
                hpBacklogNotes;
        }

        // ---------------------------------------------------------------------
        // No changes
        // ---------------------------------------------------------------------

        if (
            Object.keys(oUpdate).length === 0
        ) {

            return req.reject(
                400,
                "No editable fields supplied"
            );
        }

        // ---------------------------------------------------------------------
        // Business rules
        // ---------------------------------------------------------------------

        if (salesPrice !== undefined) {

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

        // ---------------------------------------------------------------------
        // Special Deal Flag = Yes requires Sales Price
        // ---------------------------------------------------------------------

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

        // ---------------------------------------------------------------------
        // Simple change indicator
        // ---------------------------------------------------------------------

        if (
            salesPrice !== undefined ||
            salesPriceUnit !== undefined ||
            specialDealFlagSo !== undefined ||
            hpNotesToCustomer !== undefined
        ) {

            oUpdate.simpleChangeProcessingInd =
                true;
        }

        // ---------------------------------------------------------------------
        // UPDATE
        // ---------------------------------------------------------------------

        await UPDATE(SalesOrderItems)
            .set(oUpdate)
            .where({
                salesOrder_hpSalesOrder:
                    salesOrder,

                lineId:
                    lineID
            });

        // ---------------------------------------------------------------------
        // Return result
        // ---------------------------------------------------------------------

        return {
            hpSalesOrder:
                salesOrder,

            lineId:
                lineID,

            status:
                oExisting.lineStatus_code || "",

            ordchgTriggered:
                false,

            message:
                "Sales Order item updated successfully"
        };
    });

});

