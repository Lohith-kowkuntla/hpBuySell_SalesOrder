// -----------------------------------------------------------------------------------*
// Confidential and Proprietary
// Copyright 2026, HP
// All Rights Reserved
// -----------------------------------------------------------------------------------*
// Application Name :    Sales Order
// Module           :    Summary Controller
// Namespace        :    hpbuysell.otc.salesorder.ui
// Description      :    SalesOrderSummary.controller.js
//                       Status count tiles for the HP BuySell Sales Order
//                       application (FDS 3.13), mirroring the Purchase Order
//                       app's POSummary.controller.js. Filterable by Business
//                       Model, Customer Code and HP Company Code. Tiles
//                       navigate to Sales Order Overview pre-filtered by
//                       status.
// -----------------------------------------------------------------------------------*

sap.ui.define(
    [
        "hpbuysell/otc/salesorder/ui/controller/BaseController",
        "hpbuysell/otc/salesorder/ui/model/formatter",
        "sap/ui/model/json/JSONModel",
        "sap/m/MessageBox"
    ],
    function (
        BaseController,
        formatter,
        JSONModel,
        MessageBox
    ) {
        "use strict";

        // The function returns its rows through the OData V2 adapter's
        // function-import envelope ({d:{results:[...]}}) rather than a plain
        // array, because this app is served over /odata/v2/salesorder/ - see
        // BaseController#getServiceUrl.
        var SUMMARY_FUNCTION = "getSOSummaryCounts";

        return BaseController.extend(
            "hpbuysell.otc.salesorder.ui.controller.SalesOrderSummary",
            {

                formatter: formatter,

                // =====================================================================
                // Lifecycle
                // =====================================================================

                onInit: function () {

                    this.setModel(
                        new JSONModel({
                            busy: false,
                            businessModel: "",
                            customerCode: "",
                            hpCompanyCode: ""
                        }),
                        "view"
                    );

                    this.setModel(
                        new JSONModel({
                            counts: []
                        }),
                        "summary"
                    );

                    this.getRouter()
                        .getRoute("salesOrderSummary")
                        .attachPatternMatched(
                            this._onRouteMatched,
                            this
                        );
                },


                // The counts are read fresh on every entry, because an
                // action taken on the Overview screen changes them.
                _onRouteMatched: function () {

                    this._loadCounts();
                },


                onDimensionChange: function () {

                    this._loadCounts();
                },


                onClearDimensions: function () {

                    var oViewModel = this.getModel("view");

                    oViewModel.setProperty("/businessModel", "");
                    oViewModel.setProperty("/customerCode", "");
                    oViewModel.setProperty("/hpCompanyCode", "");

                    this._loadCounts();
                },


                // =====================================================================
                // Load Logic
                // =====================================================================

                _loadCounts: function () {

                    var oViewModel = this.getModel("view");
                    var oData = oViewModel.getData();

                    // The function takes its arguments in the URL, so the
                    // empty ones are left out rather than sent as empty
                    // string literals.
                    var aQuery = [];

                    if (oData.businessModel) {
                        aQuery.push(
                            "businessModel=" + this.quote(oData.businessModel)
                        );
                    }

                    if (oData.customerCode) {
                        aQuery.push(
                            "customerCode=" + this.quote(oData.customerCode)
                        );
                    }

                    if (oData.hpCompanyCode) {
                        aQuery.push(
                            "hpCompanyCode=" + this.quote(oData.hpCompanyCode)
                        );
                    }

                    oViewModel.setProperty("/busy", true);

                    var sUrl =
                        this.getServiceUrl() +
                        SUMMARY_FUNCTION +
                        (aQuery.length ? "?" + aQuery.join("&") : "");

                    fetch(sUrl, {
                        method: "GET",
                        credentials: "same-origin",
                        headers: {
                            Accept: "application/json"
                        }
                    }).then(
                        function (oResponse) {

                            if (!oResponse.ok) {

                                throw new Error(
                                    "HTTP " + oResponse.status
                                );
                            }

                            return oResponse.json();
                        }
                    ).then(
                        function (oBody) {

                            var oResult =
                                (oBody && oBody.d && oBody.d[SUMMARY_FUNCTION]) ||
                                (oBody && oBody.d) ||
                                oBody ||
                                {};

                            var aCounts =
                                oResult.results ||
                                (Array.isArray(oResult) ? oResult : []) ||
                                [];

                            this.getModel("summary").setProperty(
                                "/counts",
                                aCounts
                            );

                        }.bind(this)
                    ).catch(
                        function (oError) {

                            // Empty tiles are a legitimate answer - a user
                            // whose scope holds nothing gets them - so a
                            // failure that is silently rendered as empty is
                            // indistinguishable from that answer, and reads
                            // as "the tiles do not load". Say so instead.
                            this.getModel("summary").setProperty(
                                "/counts",
                                []
                            );

                            MessageBox.error(
                                this.getText(
                                    "soSummaryCountsUnavailable"
                                )
                            );

                        }.bind(this)
                    ).finally(
                        function () {

                            oViewModel.setProperty(
                                "/busy",
                                false
                            );
                        }
                    );
                },


                // =====================================================================
                // Tile navigation
                // =====================================================================

                // Tile press - opens the Overview screen filtered to that
                // sales order status.
                onTilePress: function (oEvent) {

                    var oContext =
                        oEvent.getSource().getBindingContext("summary");

                    if (!oContext) {
                        return;
                    }

                    // Summary tiles are grouped by line status (see
                    // getSOSummaryCounts / SO_SUMMARY_STATUSES in
                    // srv.js), so the Overview filter to apply is
                    // lineStatus, not salesOrderStatus.
                    this.getRouter().navTo(
                        "salesOrderOverview",
                        {
                            "?query": {
                                lineStatus: oContext.getProperty("code")
                            }
                        }
                    );
                },


                onNavBackPress: function () {

                    this.onNavBack("salesOrderOverview");
                }

            }
        );
    }
);
