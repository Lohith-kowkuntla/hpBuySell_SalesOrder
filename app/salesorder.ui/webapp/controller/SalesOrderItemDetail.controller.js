// -----------------------------------------------------------------------------------*
// Confidential and Proprietary
// Copyright 2026, HP
// All Rights Reserved
// -----------------------------------------------------------------------------------*
// Application Name :    Sales Order
// Module           :    Item Detail Controller
// Namespace        :    hpbuysell.otc.salesorder
// Author           :    Abhubakar Siddik
// Created Date     :    26.08.2026
// Description      :    SalesOrderItemDetail.controller.js - Item details,
//                       quantities, pricing, notes and line-level actions.
// -----------------------------------------------------------------------------------*
// Change Log:
//    Date      |   Author      |   Defect/Incident     |   Change Description
// -----------------------------------------------------------------------------------*

sap.ui.define(
    [
        "hpbuysell/otc/salesorder/ui/controller/BaseController",
        "hpbuysell/otc/salesorder/ui/model/formatter",
        "sap/ui/model/json/JSONModel",
        "sap/m/MessageToast"
    ],
    function (BaseController, formatter, JSONModel, MessageToast) {
        "use strict";

        return BaseController.extend(
            "hpbuysell.otc.salesorder.ui.controller.SalesOrderItemDetail",
            {

                formatter: formatter,

                //---------------------------------------------------------------------------*
                // Lifecycle
                //---------------------------------------------------------------------------*

                onInit: function () {

                    this.setModel(
                        new JSONModel({
                            busy: true,
                            actionBusy: false,

                            /*
                             * Current action mode:
                             *
                             * ""       = display mode
                             * EDIT     = Update SO
                             * CANCEL   = Cancel SO line
                             */
                            mode: "",
                            prompt: "",

                            // Allowed actions returned by the service
                            canUpdate: false,
                            canCancel: false,
                            canViewHistory: false,

                            today: new Date(),

                            historyTitle: this.getText("changeHistory")
                        }),
                        "view"
                    );

                    /*
                     * Temporary values used during Update / Cancel.
                     *
                     * These values are deliberately kept outside the OData
                     * entity binding. No PATCH is triggered by simply editing
                     * the fields on screen.
                     */
                    this.setModel(
                        new JSONModel({}),
                        "edit"
                    );

                    this.getRouter()
                        .getRoute("salesOrderItemDetail")
                        .attachPatternMatched(
                            this._onRouteMatched,
                            this
                        );
                },


                /**
                 * Binds the page to the Sales Order Item identified by the
                 * route parameters.
                 */
                _onRouteMatched: function (oEvent) {

                    var oArgs = oEvent.getParameter("arguments");

                    this._sSalesOrder = decodeURIComponent(
                        oArgs.salesOrder
                    );

                    this._sLineId = decodeURIComponent(
                        oArgs.lineId
                    );

                    this.getModel("view").setProperty(
                        "/busy",
                        true
                    );

                    /*
                     * A mode belongs to the item that started it.
                     * Every new route starts in display mode.
                     */
                    this.onExitMode();

                    this.getView().bindElement({

                        path: this.buildSalesOrderItemPath(
                            this._sSalesOrder,
                            this._sLineId
                        ),

                        events: {

                            change: this._onBindingChange.bind(this),

                            dataRequested: function () {

                                this.getModel("view").setProperty(
                                    "/busy",
                                    true
                                );

                            }.bind(this),

                            dataReceived: function (oDataEvent) {

                                this.getModel("view").setProperty(
                                    "/busy",
                                    false
                                );

                                /*
                                 * No entity was returned.
                                 */
                                if (!oDataEvent.getParameter("data")) {

                                    this._showNotFound();

                                    return;
                                }

                                this._refreshActions();

                            }.bind(this)

                        }

                    });
                },


                _onBindingChange: function () {

                    var oBinding =
                        this.getView().getElementBinding();

                    this.getModel("view").setProperty(
                        "/busy",
                        false
                    );

                    if (
                        oBinding &&
                        !oBinding.getBoundContext()
                    ) {

                        this._showNotFound();

                        return;
                    }

                    this._refreshActions();
                },


                _showNotFound: function () {

                    this.getRouter()
                        .getTargets()
                        .display("notFound");
                },


                //---------------------------------------------------------------------------*
                // Child Tables
                //---------------------------------------------------------------------------*

                onHistoryUpdateFinished: function (oEvent) {

                    this._setTableTitle(
                        "/historyTitle",
                        "changeHistory",
                        oEvent.getParameter("total")
                    );
                },


                _setTableTitle: function (
                    sProperty,
                    sTextKey,
                    iCount
                ) {

                    this.getModel("view").setProperty(
                        sProperty,
                        this.getText(
                            "titleWithCount",
                            [
                                this.getText(sTextKey),
                                iCount || 0
                            ]
                        )
                    );
                },


                //---------------------------------------------------------------------------*
                // Sales Order Line
                //---------------------------------------------------------------------------*

                /**
                 * Returns the currently bound Sales Order Item in the
                 * vocabulary used by the controller actions.
                 */
                _getLine: function () {

                    var oContext =
                        this.getView().getBindingContext();

                    if (!oContext) {
                        return null;
                    }

                    return {

                        salesOrder: oContext.getProperty(
                            "salesOrder"
                        ),

                        lineId: oContext.getProperty(
                            "lineId"
                        ),

                        hpPartNumber: oContext.getProperty(
                            "hpPartNumber"
                        ),

                        hpPartDescription: oContext.getProperty(
                            "hpPartDescription"
                        ),

                        customerPartNumber: oContext.getProperty(
                            "customerPartNumber"
                        ),

                        customerLineId: oContext.getProperty(
                            "customerLineId"
                        ),

                        fromLine: oContext.getProperty(
                            "fromLine"
                        ),

                        quantity: oContext.getProperty(
                            "quantity"
                        ),

                        quantityUnit: oContext.getProperty(
                            "quantityUnit"
                        ),

                        plannedReceiptDate: oContext.getProperty(
                            "plannedReceiptDate"
                        ),

                        originalPlannedReceiptDate:
                            oContext.getProperty(
                                "originalPlannedReceiptDate"
                            ),

                        salesPrice: oContext.getProperty(
                            "salesPrice"
                        ),

                        salesPriceUnit: String(
                            oContext.getProperty(
                                "salesPriceUnit"
                            ) || 1
                        ),

                        salesPriceCurrency:
                            oContext.getProperty(
                                "salesPriceCurrency"
                            ),

                        lineAmount: oContext.getProperty(
                            "lineAmount"
                        ),

                        lineAmountCurrency:
                            oContext.getProperty(
                                "lineAmountCurrency"
                            ),

                        confirmedQuantity:
                            oContext.getProperty(
                                "confirmedQuantity"
                            ),

                        confirmedReceiptDate:
                            oContext.getProperty(
                                "confirmedReceiptDate"
                            ),

                        balanceQuantity:
                            oContext.getProperty(
                                "balanceQuantity"
                            ),

                        specialDealFlagSo:
                            oContext.getProperty(
                                "specialDealFlagSo"
                            ),

                        hpNotesToCustomer:
                            oContext.getProperty(
                                "hpNotesToCustomer"
                            ),

                        hpBacklogNotes:
                            oContext.getProperty(
                                "hpBacklogNotes"
                            ),

                        reasonForCancellation:
                            oContext.getProperty(
                                "reasonForCancellation"
                            ),

                        hpPurchaseOrder:
                            oContext.getProperty(
                                "hpPurchaseOrder"
                            ),

                        hpPoLineItem:
                            oContext.getProperty(
                                "hpPoLineItem"
                            ),

                        soRequisitionNumber:
                            oContext.getProperty(
                                "soRequisitionNumber"
                            ),

                        requestStatus:
                            oContext.getProperty(
                                "requestStatus"
                            ),

                        allowedActions:
                            oContext.getProperty(
                                "allowedActions"
                            )
                    };
                },


                //---------------------------------------------------------------------------*
                // Allowed Actions
                //---------------------------------------------------------------------------*

                /**
                 * Reads allowedActions from the Sales Order Item and
                 * updates the page view model.
                 */
                _refreshActions: function () {

                    var oLine = this._getLine();

                    var sAllowed =
                        (
                            oLine &&
                            oLine.allowedActions
                        ) || "";

                    var oViewModel =
                        this.getModel("view");

                    oViewModel.setProperty(
                        "/canUpdate",
                        formatter.hasAction(
                            sAllowed,
                            "UPDATE"
                        )
                    );

                    oViewModel.setProperty(
                        "/canCancel",
                        formatter.hasAction(
                            sAllowed,
                            "CANCEL"
                        )
                    );

                    oViewModel.setProperty(
                        "/canViewHistory",
                        formatter.hasAction(
                            sAllowed,
                            "VIEWHISTORY"
                        )
                    );
                },


                //---------------------------------------------------------------------------*
                // Mode Handling
                //---------------------------------------------------------------------------*

                /**
                 * Enters EDIT or CANCEL mode.
                 */
                _enterMode: function (
                    sMode,
                    oData,
                    sPrompt
                ) {

                    this.setModel(
                        new JSONModel(
                            oData || {}
                        ),
                        "edit"
                    );

                    var oViewModel =
                        this.getModel("view");

                    oViewModel.setProperty(
                        "/mode",
                        sMode
                    );

                    oViewModel.setProperty(
                        "/prompt",
                        sPrompt
                    );
                },


                /**
                 * Leaves the current action mode and clears
                 * temporary edit data.
                 */
                onExitMode: function () {

                    var oViewModel =
                        this.getModel("view");

                    oViewModel.setProperty(
                        "/mode",
                        ""
                    );

                    oViewModel.setProperty(
                        "/prompt",
                        ""
                    );

                    this.setModel(
                        new JSONModel({}),
                        "edit"
                    );
                },


                //---------------------------------------------------------------------------*
                // Update Sales Order Line
                //---------------------------------------------------------------------------*

                /**
                 * Starts Update SO Line mode.
                 *
                 * Only Phase-1 editable Sales Order fields are seeded:
                 *
                 * - Sales Price
                 * - Sales Price Unit
                 * - Special Deal Flag
                 * - HP Notes to Customer
                 * - HP Backlog Notes
                 */
                onUpdateLine: function () {

                    var oLine = this._getLine();

                    if (!oLine) {
                        return;
                    }

                    this._enterMode(
                        "EDIT",
                        {

                            salesPrice:
                                oLine.salesPrice,

                            salesPriceUnit:
                                oLine.salesPriceUnit,

                            originalSalesPrice:
                                oLine.salesPrice,

                            specialDealFlagSo:
                                oLine.specialDealFlagSo,

                            hpNotesToCustomer:
                                oLine.hpNotesToCustomer || "",

                            hpBacklogNotes:
                                oLine.hpBacklogNotes || ""

                        },
                        this.getText(
                            "editLinePrompt",
                            [
                                oLine.lineId
                            ]
                        )
                    );
                },


                //---------------------------------------------------------------------------*
                // Cancel Sales Order Line
                //---------------------------------------------------------------------------*

                /**
                 * Starts Cancel SO Line mode.
                 */
                onCancelLine: function () {

                    var oLine = this._getLine();

                    if (!oLine) {
                        return;
                    }

                    this._enterMode(
                        "CANCEL",
                        {
                            reasonForCancellation: ""
                        },
                        this.getText(
                            "cancelLinePrompt",
                            [
                                oLine.lineId
                            ]
                        )
                    );
                },


                //---------------------------------------------------------------------------*
                // View History
                //---------------------------------------------------------------------------*

                /**
                 * Navigates to the Sales Order Item History page.
                 */
                onViewHistory: function () {

                    var oLine = this._getLine();

                    if (!oLine) {
                        return;
                    }

                    this.navToHistory(
                        oLine.salesOrder,
                        oLine.lineId
                    );
                },


                //---------------------------------------------------------------------------*
                // Field Change Handlers
                //---------------------------------------------------------------------------*

                /**
                 * Keeps Sales Price in the edit model while the
                 * user types.
                 */
                onSalesPriceLiveChange: function (oEvent) {

                    this.getModel("edit").setProperty(
                        "/salesPrice",
                        oEvent.getParameter("value")
                    );
                },


                /**
                 * Backward-compatible alias if the XML uses
                 * onPriceLiveChange.
                 */
                onPriceLiveChange: function (oEvent) {

                    this.onSalesPriceLiveChange(oEvent);
                },


                //---------------------------------------------------------------------------*
                // Save Update
                //---------------------------------------------------------------------------*

                /**
                 * Saves the Sales Order item changes.
                 */
                onSaveEdit: function () {

                    var oLine = this._getLine();

                    var oData =
                        this.getModel("edit").getData();

                    if (!oLine) {
                        return;
                    }

                    var sError =
                        this.validateLineChange(
                            oData
                        );

                    if (sError) {

                        this._showError(
                            sError
                        );

                        return;
                    }

                    var bPriceChanged =
                        this.isSalesPriceChanged(
                            oData.originalSalesPrice,
                            oData.salesPrice
                        );

                    this._callAction(
                        "updateSalesOrderItem",
                        {

                            salesOrder:
                                oLine.salesOrder,

                            lineId:
                                oLine.lineId,

                            salesPrice:
                                parseFloat(
                                    oData.salesPrice
                                ),

                            salesPriceUnit:
                                parseInt(
                                    oData.salesPriceUnit,
                                    10
                                ),

                            specialDealFlagSo:
                                oData.specialDealFlagSo,

                            hpNotesToCustomer:
                                oData.hpNotesToCustomer,

                            hpBacklogNotes:
                                oData.hpBacklogNotes,

                            priceChanged:
                                bPriceChanged

                        }
                    );
                },


                //---------------------------------------------------------------------------*
                // Confirm Cancellation
                //---------------------------------------------------------------------------*

                onConfirmCancelLine: function () {

                    var oLine = this._getLine();

                    var oData =
                        this.getModel("edit").getData();

                    if (!oLine) {
                        return;
                    }

                    if (
                        !oData.reasonForCancellation
                    ) {

                        this._showError(
                            this.getText(
                                "cancellationReasonRequired"
                            )
                        );

                        return;
                    }

                    this._callAction(
                        "cancelSalesOrderItem",
                        {

                            salesOrder:
                                oLine.salesOrder,

                            lineId:
                                oLine.lineId,

                            reasonForCancellation:
                                oData.reasonForCancellation

                        }
                    );
                },


                //---------------------------------------------------------------------------*
                // Validation
                //---------------------------------------------------------------------------*

                /**
                 * Client-side validation for Sales Order update.
                 *
                 * The service remains authoritative; these checks only
                 * prevent an unnecessary round trip for obviously invalid
                 * input.
                 */
                validateLineChange: function (oData) {

                    if (
                        oData.salesPrice === null ||
                        oData.salesPrice === undefined ||
                        oData.salesPrice === ""
                    ) {

                        return this.getText(
                            "salesPriceRequired"
                        );
                    }

                    var fSalesPrice =
                        parseFloat(
                            oData.salesPrice
                        );

                    if (
                        Number.isNaN(
                            fSalesPrice
                        ) ||
                        fSalesPrice < 0
                    ) {

                        return this.getText(
                            "invalidSalesPrice"
                        );
                    }

                    if (
                        !oData.salesPriceUnit
                    ) {

                        return this.getText(
                            "salesPriceUnitRequired"
                        );
                    }

                    if (
                        oData.specialDealFlagSo === null ||
                        oData.specialDealFlagSo === undefined ||
                        oData.specialDealFlagSo === ""
                    ) {

                        return this.getText(
                            "specialDealFlagRequired"
                        );
                    }

                    return null;
                },


                /**
                 * Compares the original and current Sales Price.
                 */
                isSalesPriceChanged: function (
                    vOriginal,
                    vCurrent
                ) {

                    var fOriginal =
                        parseFloat(
                            vOriginal
                        );

                    var fCurrent =
                        parseFloat(
                            vCurrent
                        );

                    if (
                        Number.isNaN(
                            fOriginal
                        ) &&
                        Number.isNaN(
                            fCurrent
                        )
                    ) {

                        return false;
                    }

                    return fOriginal !== fCurrent;
                },


                //---------------------------------------------------------------------------*
                // Action Handling
                //---------------------------------------------------------------------------*

                /**
                 * Executes an unbound Sales Order action.
                 */
                _callAction: function (
                    sAction,
                    oPayload
                ) {

                    var oViewModel =
                        this.getModel("view");

                    oViewModel.setProperty(
                        "/actionBusy",
                        true
                    );

                    return this.callLineAction(
                        sAction,
                        oPayload
                    )
                        .then(
                            function (oResult) {

                                MessageToast.show(
                                    (
                                        oResult &&
                                        oResult.message
                                    ) ||
                                    this.getText(
                                        "actionCompleted"
                                    )
                                );

                                this.onExitMode();

                                /*
                                 * Refresh the OData model so that:
                                 *
                                 * - Sales Price
                                 * - Line Amount
                                 * - Status
                                 * - Confirmation
                                 * - Balance Quantity
                                 * - allowedActions
                                 *
                                 * are re-read from the service.
                                 */
                                this.getModel().refresh(
                                    true
                                );

                            }.bind(this)
                        )
                        .catch(
                            function (oError) {

                                this._showError(
                                    oError.message
                                );

                            }.bind(this)
                        )
                        .finally(
                            function () {

                                oViewModel.setProperty(
                                    "/actionBusy",
                                    false
                                );

                            }.bind(this)
                        );
                },


                //---------------------------------------------------------------------------*
                // Error Handling
                //---------------------------------------------------------------------------*

                _showError: function (
                    sMessage
                ) {

                    MessageToast.show(
                        sMessage
                    );
                },


                //---------------------------------------------------------------------------*
                // Navigation
                //---------------------------------------------------------------------------*

                /**
                 * Back to Sales Order Header.
                 *
                 * The item page belongs directly to the Sales Order
                 * header, so deep-link fallback goes to the header.
                 */
                onNavBackPress: function () {

                    this.navBackTo(
                        "salesOrderDetail",
                        {
                            salesOrder:
                                this._sSalesOrder
                        }
                    );
                },


                /**
                 * Direct navigation to Sales Order Header.
                 */
                onNavToHeader: function () {

                    this.navToSalesOrder(
                        this._sSalesOrder
                    );
                },


                /**
                 * Navigation to the related Purchase Order.
                 */
                onNavToPurchaseOrder: function () {

                    var oLine =
                        this._getLine();

                    if (
                        !oLine ||
                        !oLine.hpPurchaseOrder
                    ) {
                        return;
                    }

                    this.navToPurchaseOrder(
                        oLine.hpPurchaseOrder,
                        oLine.hpPoLineItem
                    );
                }

            }
        );
    }
);