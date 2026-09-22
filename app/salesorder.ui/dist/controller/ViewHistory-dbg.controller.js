// -----------------------------------------------------------------------------------*
// Confidential and Proprietary
// Copyright 2026, HP
// All Rights Reserved
// -----------------------------------------------------------------------------------*
// Application Name :    Sales Order
// Module           :    View History Controller
// Namespace        :    hpbuysell.otc.salesorder
// Description      :    ViewHistory.controller.js - Chronological audit trail of a
//                       sales order line (FDS section 3.7.9 / 6.7 "Order Change
//                       Tracking & View History"), read from the standard change
//                       log of @cap-js/change-tracking.
//
//                       Adapted 1:1 from the Purchase Order app's
//                       ViewHistory.controller.js:
//                         - route params purchaseOrderNumber/poLineId
//                           -> salesOrder/lineId
//                         - navToPurchaseOrderItem -> navToSalesOrderItem
//                         - back target purchaseOrderItemDetail
//                           -> salesOrderItemDetail
//                         - overview route purchaseOrderOverview
//                           -> salesOrderOverview
// -----------------------------------------------------------------------------------*
// Change Log:
//    Date      |   Author      |   Defect/Incident     |   Change Description
//    04.09.2026|   Claude      |   -                    |   Initial version, ported
//                                                            from the Purchase Order
//                                                            ViewHistory controller.
// -----------------------------------------------------------------------------------*

sap.ui.define(
    [
        "hpbuysell/otc/salesorder/ui/controller/BaseController",
        "hpbuysell/otc/salesorder/ui/model/formatter",
        "sap/ui/model/json/JSONModel",
        "sap/ui/model/Filter",
        "sap/ui/model/FilterOperator"
    ],
    function (BaseController, formatter, JSONModel, Filter, FilterOperator) {
        "use strict";

        // The plugin builds objectID from the @changelog identifiers declared in
        // the db model: the document number alone for a header change, the
        // document number and the line id for a line change.
        //
        // ASSUMPTION: this mirrors the Purchase Order app's convention
        // (PurchaseOrderNumber / "PurchaseOrderNumber, LineId"). Verify against
        // the actual @changelog annotations on SalesOrders / SalesOrderItems in
        // your db model - if the SO objectID is composed differently (e.g. a
        // different separator, or additional key parts), update headerObjectId /
        // lineObjectId below to match, otherwise the scope filter below will
        // silently return zero rows.
        function headerObjectId(sSalesOrder) {
            return sSalesOrder;
        }

        function lineObjectId(sSalesOrder, sLineId) {
            return sSalesOrder + ", " + sLineId;
        }

        return BaseController.extend("hpbuysell.otc.salesorder.ui.controller.ViewHistory", {

            formatter: formatter,

            //---------------------------------------------------------------------------*
            // Lifecycle
            //---------------------------------------------------------------------------*

            onInit: function () {
                this.setModel(new JSONModel({
                    busy: false,
                    pageTitle: this.getText("viewHistory"),
                    lineTitle: "",
                    tableTitle: this.getText("changeHistory")
                }), "view");

                this._sScope = "ALL";
                this._sQuery = "";

                this.getRouter()
                    .getRoute("viewHistory")
                    .attachPatternMatched(this._onRouteMatched, this);
            },

            _onRouteMatched: function (oEvent) {
                var oArgs = oEvent.getParameter("arguments");

                this._sSalesOrder = decodeURIComponent(oArgs.salesOrder);
                this._sLineId = decodeURIComponent(oArgs.lineId);

                var oViewModel = this.getModel("view");

                oViewModel.setProperty(
                    "/pageTitle",
                    this.getText("viewHistoryTitle", [this._sSalesOrder, this._sLineId])
                );
                oViewModel.setProperty(
                    "/lineTitle",
                    this.getText("lineTitle", [this._sSalesOrder, this._sLineId])
                );

                // Reset the local filters so a second visit does not inherit the
                // narrowing of the first
                this._sScope = "ALL";
                this._sQuery = "";

                var oScope = this.byId("selHistScope");
                var oSearch = this.byId("historySearch");

                if (oScope) oScope.setSelectedKey("ALL");
                if (oSearch) oSearch.setValue("");

                this._applyFilters();
            },

            //---------------------------------------------------------------------------*
            // Filtering
            //---------------------------------------------------------------------------*

            onHistorySearch: function (oEvent) {
                this._sQuery = (oEvent.getParameter("query") || "").trim();
                this._applyFilters();
            },

            onScopeChange: function (oEvent) {
                this._sScope = oEvent.getParameter("selectedItem").getKey();
                this._applyFilters();
            },

            /**
             * Restricts the trail to the sales document, then to the requested
             * scope and free text.
             *
             * The default scope shows the line's own changes together with the
             * header changes, because a header change (e.g. HP Notes to
             * Customer at header level) can be relevant context for the line too.
             */
            _applyFilters: function () {
                var oBinding = this.byId("historyTable").getBinding("items");

                if (!oBinding) {
                    return;
                }

                var sHeader = headerObjectId(this._sSalesOrder);
                var sLine = lineObjectId(this._sSalesOrder, this._sLineId);

                /*
                 * A composition marker: the plugin writes one entry per changed
                 * child collection, carrying no old or new value, so that the
                 * hierarchy view can nest the child entries under their parent. A
                 * flat chronological list has nothing to show for it.
                 */
                var aFilters = [
                    new Filter("attribute", FilterOperator.NE, "items")
                ];

                if (this._sScope === "LINE") {
                    aFilters.push(new Filter("objectID", FilterOperator.EQ, sLine));
                } else if (this._sScope === "HEADER") {
                    aFilters.push(new Filter("objectID", FilterOperator.EQ, sHeader));
                } else {
                    aFilters.push(new Filter({
                        filters: [
                            new Filter("objectID", FilterOperator.EQ, sLine),
                            new Filter("objectID", FilterOperator.EQ, sHeader)
                        ],
                        and: false
                    }));
                }

                if (this._sQuery) {
                    aFilters.push(new Filter({
                        filters: [
                            new Filter("attributeLabel", FilterOperator.Contains, this._sQuery),
                            new Filter("attribute", FilterOperator.Contains, this._sQuery),
                            new Filter("valueChangedFromLabel", FilterOperator.Contains, this._sQuery),
                            new Filter("valueChangedToLabel", FilterOperator.Contains, this._sQuery),
                            new Filter("createdBy", FilterOperator.Contains, this._sQuery),
                            new Filter("objectID", FilterOperator.Contains, this._sQuery)
                        ],
                        and: false
                    }));
                }

                oBinding.filter(new Filter({ filters: aFilters, and: true }));
                oBinding.attachEventOnce("dataReceived", this._onDataReceived, this);
            },

            _onDataReceived: function () {
                var oBinding = this.byId("historyTable").getBinding("items");
                var iCount = oBinding ? (oBinding.getLength() || 0) : 0;

                this.getModel("view").setProperty(
                    "/tableTitle",
                    this.getText("titleWithCount", [this.getText("changeHistory"), iCount])
                );
            },

            //---------------------------------------------------------------------------*
            // Navigation
            //---------------------------------------------------------------------------*

            onNavToOverview: function () {
                this.getRouter().navTo("salesOrderOverview");
            },

            onNavToLine: function () {
                this.navToSalesOrderItem(this._sSalesOrder, this._sLineId);
            },

            /**
             * Back goes one level up the hierarchy, to the line this trail belongs to.
             */
            onNavBackPress: function () {
                this.navBackTo("salesOrderItemDetail", {
                    salesOrder: this._sSalesOrder,
                    lineId: this._sLineId
                });
            }
        });
    }
);