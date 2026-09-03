// -----------------------------------------------------------------------------------*
// Confidential and Proprietary
// Copyright 2026, HP
// All Rights Reserved
// -----------------------------------------------------------------------------------*
// Application Name :    Sales Order
// Module           :    Overview / Search Controller
// Namespace        :    hpbuysell.otc.salesorder.ui
// Author           :    HP BuySell Development Team
// Created Date     :    26.08.2026
// Description      :    SalesOrderOverview.controller.js
//                       Search screen of the HP BuySell Sales Order application.
//                       Handles the SmartFilterBar, value helps, search variants,
//                       SmartTable, row selection, navigation and export.
//
//                       Sales Order actions are handled according to the service
//                       contract:
//                         - updateSalesOrder
//                         - cancelLine
// -----------------------------------------------------------------------------------*

sap.ui.define(
    [
        "hpbuysell/otc/salesorder/ui/controller/BaseController",
        "hpbuysell/otc/salesorder/ui/model/formatter",
        "sap/ui/model/json/JSONModel",
        "sap/ui/model/Filter",
        "sap/ui/model/FilterOperator",
        "sap/ui/core/Fragment",
        "sap/ui/core/Item",
        "sap/ui/comp/valuehelpdialog/ValueHelpDialog",
        "sap/ui/table/Table",
        "sap/ui/table/Column",
        "sap/m/Label",
        "sap/m/Text",
        "sap/m/MessageBox",
        "sap/m/MessageToast"
    ],
    function (
        BaseController,
        formatter,
        JSONModel,
        Filter,
        FilterOperator,
        Fragment,
        Item,
        ValueHelpDialog,
        UITable,
        UI5TableColumn,
        Label,
        Text,
        MessageBox,
        MessageToast
    ) {
        "use strict";

        // -------------------------------------------------------------------------
        // Export configuration
        // -------------------------------------------------------------------------

        var FORMATS = ["XLSX", "CSV"];
        var LAYOUTS = ["SEARCHRESULT", "SUMMARY"];
        var SCOPES = ["ALL", "PAGE", "SELECTED"];

        // -------------------------------------------------------------------------
        // Value Help configuration
        // -------------------------------------------------------------------------
        //
        // key          = SmartFilterBar property
        // entity       = OData Value Help entity
        // valueField   = property used as actual selected value
        // description  = optional display description
        // title        = dialog title
        // multi        = multiple token selection
        //
        // -------------------------------------------------------------------------

        var VALUE_HELP_CONFIG = {

            hpSalesOrder: {
                entity: "VH_SalesOrderNumber",
                valueField: "hpSalesOrder",
                descriptionField: "customerDescription",
                title: "HP Sales Order",
                multi: true
            },

            customerCode: {
                entity: "VH_Customer",
                valueField: "customerCode",
                descriptionField: "customerDescription",
                title: "Customer",
                multi: true
            },

            customerDescription: {
                entity: "VH_Customer",
                valueField: "customerDescription",
                descriptionField: "customerCode",
                title: "Customer Description",
                multi: true
            },

            customerOrder: {
                entity: "VH_CustomerOrder",
                valueField: "customerOrder",
                title: "Customer Order",
                multi: true
            },

            hpPartNumber: {
                entity: "VH_HpPartNumber",
                valueField: "hpPartNumber",
                descriptionField: "hpPartDescription",
                title: "HP Part Number",
                multi: true
            },

            hpPartDescription: {
                entity: "VH_HpPartNumber",
                valueField: "hpPartDescription",
                descriptionField: "hpPartNumber",
                title: "HP Part Description",
                multi: true
            },

            customerPartNumber: {
                entity: "VH_CustomerPart",
                valueField: "customerPartNumber",
                descriptionField: "hpPartNumber",
                title: "Customer Part Number",
                multi: true
            },

            hpBuyerCode: {
                entity: "VH_Buyer",
                valueField: "hpBuyerCode",
                descriptionField: "hpBuyerName",
                title: "HP Buyer Code",
                multi: true
            },

            hpBuyerName: {
                entity: "VH_Buyer",
                valueField: "hpBuyerName",
                descriptionField: "hpBuyerCode",
                title: "HP Buyer Name",
                multi: true
            },

            hpCompanyCode: {
                entity: "VH_CompanyCode",
                valueField: "hpCompanyCode",
                descriptionField: "hpCompanyDescription",
                title: "HP Company Code",
                multi: true
            },

            hpCompanyDescription: {
                entity: "VH_CompanyCode",
                valueField: "hpCompanyDescription",
                descriptionField: "hpCompanyCode",
                title: "HP Company Description",
                multi: true
            },

            hpSalesOrganization: {
                entity: "VH_SalesOrganization",
                valueField: "hpSalesOrganization",
                title: "HP Sales Organization",
                multi: true
            },

            hpPlant: {
                entity: "VH_Plant",
                valueField: "hpPlant",
                title: "HP Plant",
                multi: true
            },

            businessUnit: {
                entity: "VH_BusinessUnit",
                valueField: "businessUnit",
                title: "Business Unit",
                multi: false
            },

            businessModel: {
                entity: "VH_BusinessModel",
                valueField: "businessModel",
                title: "Business Model",
                multi: false
            },

            wbsProjectCode: {
                entity: "VH_WbsProject",
                valueField: "wbsProjectCode",
                descriptionField: "wbsProjectCodeDescription",
                title: "WBS Project Code",
                multi: true
            },

            shipTo: {
                entity: "VH_ShipTo",
                valueField: "shipTo",
                title: "Ship To",
                multi: true
            },

            billTo: {
                entity: "VH_BillTo",
                valueField: "billTo",
                title: "Bill To",
                multi: true
            },

            payer: {
                entity: "VH_Payer",
                valueField: "payer",
                title: "Payer",
                multi: true
            },

            otherShipTo: {
                entity: "VH_OtherShipTo",
                valueField: "otherShipTo",
                title: "Other Ship To",
                multi: true
            },

            paymentTerms: {
                entity: "VH_PaymentTerms",
                valueField: "paymentTerms",
                title: "Payment Terms",
                multi: true
            },

            storageLocation: {
                entity: "VH_StorageLocation",
                valueField: "storageLocation",
                title: "Storage Location",
                multi: true
            },

            endSupplier: {
                entity: "VH_EndSupplier",
                valueField: "endSupplier",
                title: "End Supplier",
                multi: true
            },

            soAckOutOrigin: {
                entity: "VH_SoAckOutOrigin",
                valueField: "soAckOutOrigin",
                title: "SO Ack Out Origin",
                multi: true
            },

            soChangeInOrigin: {
                entity: "VH_SoChangeInOrigin",
                valueField: "soChangeInOrigin",
                title: "SO Change In Origin",
                multi: true
            },

            salesOrderType: {
                entity: "VH_SalesOrderType",
                valueField: "code",
                title: "Sales Order Type",
                multi: true
            },

            salesOrderOrigin: {
                entity: "VH_SalesOrderOrigin",
                valueField: "code",
                title: "Sales Order Origin",
                multi: true
            },

            salesOrderStatus: {
                entity: "VH_OrderStatus",
                valueField: "code",
                title: "Sales Order Status",
                multi: true
            },

            lineStatus: {
                entity: "VH_LineStatus",
                valueField: "code",
                title: "Line Status",
                multi: true
            },

            specialDealFlagSo: {
                entity: "VH_SpecialDealFlag",
                valueField: "code",
                descriptionField: "description",
                title: "Special Deal Flag",
                multi: false
            },

            gtsHold: {
                entity: "VH_GtsHold",
                valueField: "code",
                descriptionField: "description",
                title: "GTS Hold",
                multi: false
            },

            blanketIndicator: {
                entity: "VH_BlanketIndicator",
                valueField: "code",
                descriptionField: "description",
                title: "Blanket Indicator",
                multi: false
            }
        };

        return BaseController.extend(
            "hpbuysell.otc.salesorder.ui.controller.SalesOrderOverview",
            {

                formatter: formatter,

                // =====================================================================
                // Lifecycle
                // =====================================================================

                onInit: function () {

                    this.setModel(
                        new JSONModel({
                            exportBusy: false,
                            actionBusy: false,
                            selectedCount: 0,
                            selectionText: "",
                            filterSummary: this.getText("filterHint"),
                            today: new Date()
                        }),
                        "view"
                    );

                    this._mValueHelpDialogs = {};

                    this.getRouter()
                        .getRoute("salesOrderOverview")
                        .attachPatternMatched(
                            this._onRouteMatched,
                            this
                        );
                },


                /**
                 * Called whenever the Sales Order Overview route is matched.
                 */
                _onRouteMatched: function (oEvent) {

                    var oArguments =
                        oEvent.getParameter("arguments") || {};

                    var oQuery =
                        oArguments["?query"] || {};

                    var sStatus =
                        oQuery.lineStatus ||
                        oQuery.salesOrderStatus;

                    if (sStatus) {
                        this._applyStatusFilter(sStatus);
                        return;
                    }

                    if (this._bLoaded) {
                        this._rebindTable();
                    }

                    this._bLoaded = true;
                },


                // =====================================================================
                // Status filtering
                // =====================================================================

                _applyStatusFilter: function (sStatus) {

                    var oFilterBar = this._getFilterBar();

                    if (!oFilterBar) {
                        return;
                    }

                    oFilterBar.clear();

                    oFilterBar.setFilterData(
                        {
                            lineStatus: {
                                items: [
                                    {
                                        key: sStatus
                                    }
                                ]
                            }
                        },
                        true
                    );

                    this._bLoaded = true;

                    oFilterBar.search();
                },


                // =====================================================================
                // Smart Filter Bar
                // =====================================================================

                onFilterBarInitialised: function () {

                    this._setupValueHelps();

                    this._updateFilterSummary();
                },


                /**
                 * Configures value-help dialogs for SmartFilterBar controls.
                 *
                 * SmartFilterBar creates the actual input controls dynamically.
                 * Therefore value-help configuration must happen after
                 * SmartFilterBar initialisation.
                 */
                _setupValueHelps: function () {

                    var oFilterBar = this._getFilterBar();

                    if (!oFilterBar) {
                        return;
                    }

                    Object.keys(VALUE_HELP_CONFIG).forEach(
                        function (sKey) {

                            if (sKey === "specialDealFlagSo") {
                                return;
                            }


                            var oConfig =
                                VALUE_HELP_CONFIG[sKey];

                            var oControl =
                                oFilterBar.getControlByKey(
                                    sKey
                                );

                            if (!oControl) {
                                return;
                            }

                            this._attachValueHelp(
                                oControl,
                                sKey,
                                oConfig
                            );

                        }.bind(this)
                    );
                },


                /**
                 * Attaches value-help request to a generated filter control.
                 */
                _attachValueHelp: function (
                    oControl,
                    sFilterKey,
                    oConfig
                ) {

                    /*
                     * sap.m.Input / MultiInput support value-help directly.
                     */
                    if (
                        typeof oControl.setShowValueHelp ===
                        "function"
                    ) {

                        oControl.setShowValueHelp(true);

                        if (
                            typeof oControl.setValueHelpOnly ===
                            "function"
                        ) {
                            oControl.setValueHelpOnly(false);
                        }

                        /*
                         * Avoid duplicate event registration.
                         */
                        if (
                            !oControl.data(
                                "salesOrderValueHelpAttached"
                            )
                        ) {

                            oControl.attachValueHelpRequest(
                                function (oEvent) {

                                    this._openValueHelp(
                                        oEvent.getSource(),
                                        sFilterKey,
                                        oConfig
                                    );

                                }.bind(this)
                            );

                            oControl.data(
                                "salesOrderValueHelpAttached",
                                true
                            );
                        }

                        return;
                    }

                    /*
                     * Some SmartFilterBar configurations can generate
                     * ComboBox/MultiComboBox controls. Those controls don't
                     * expose valueHelpRequest.
                     *
                     * Their items can be populated directly from the
                     * corresponding VH entity.
                     */
                    if (
                        typeof oControl.bindItems ===
                        "function"
                    ) {

                        this._bindComboBoxValueHelp(
                            oControl,
                            oConfig
                        );
                    }
                },


                /**
                 * Binds a code-list VH to ComboBox/MultiComboBox controls.
                 */
                _bindComboBoxValueHelp: function (
                    oControl,
                    oConfig
                ) {

                    var oModel =
                        this.getView().getModel();

                    if (!oModel) {
                        return;
                    }

                    var sTextPath =
                        oConfig.descriptionField
                            ? "{" +
                            oConfig.descriptionField +
                            "}"
                            : "{" +
                            oConfig.valueField +
                            "}";

                    oControl.bindItems({
                        path:
                            "/" +
                            oConfig.entity,

                        template:
                            new Item({
                                key:
                                    "{" +
                                    oConfig.valueField +
                                    "}",

                                text:
                                    sTextPath
                            }),

                        templateShareable: false
                    });
                },


                /**
                 * Opens generic Sales Order ValueHelpDialog.
                 */
                _openValueHelp: function (
                    oInput,
                    sFilterKey,
                    oConfig
                ) {

                    var sDialogKey =
                        sFilterKey;

                    /*
                     * Reuse existing dialog.
                     */
                    if (
                        this._mValueHelpDialogs[
                        sDialogKey
                        ]
                    ) {

                        this._openExistingValueHelp(
                            oInput,
                            sFilterKey,
                            oConfig
                        );

                        return;
                    }

                    var oDialog =
                        new ValueHelpDialog({

                            title:
                                oConfig.title,

                            supportMultiselect:
                                oConfig.multi !== false,

                            supportRanges: true,

                            supportRangesOnly: false,

                            key:
                                oConfig.valueField,

                            descriptionKey:
                                oConfig.descriptionField,

                            stretch:
                                sap.ui.Device.system.phone,

                            ok: function (oEvent) {

                                this._onValueHelpOk(
                                    oEvent,
                                    oInput,
                                    sFilterKey,
                                    oConfig
                                );

                            }.bind(this),

                            cancel: function () {

                                oDialog.close();

                            },

                            afterClose: function () {

                                /*
                                 * Keep dialog instance for reuse.
                                 */
                            }
                        });

                    this.getView().addDependent(
                        oDialog
                    );

                    this._mValueHelpDialogs[
                        sDialogKey
                    ] = oDialog;

                    this._buildValueHelpTable(
                        oDialog,
                        oConfig
                    );

                    this._openExistingValueHelp(
                        oInput,
                        sFilterKey,
                        oConfig
                    );
                },


                /**
                 * Creates table inside ValueHelpDialog.
                 */
                _buildValueHelpTable: function (
                    oDialog,
                    oConfig
                ) {

                    var oTable =
                        new UITable({
                            selectionMode:
                                oConfig.multi === false
                                    ? "Single"
                                    : "MultiToggle",

                            visibleRowCount: 10,

                            enableSelectAll: true,

                            width: "100%"
                        });

                    /*
                     * Main value column.
                     */
                    oTable.addColumn(
                        new UI5TableColumn({
                            label:
                                new Label({
                                    text:
                                        oConfig.title
                                }),

                            template:
                                new Text({
                                    text:
                                        "{" +
                                        oConfig.valueField +
                                        "}"
                                }),

                            sortProperty:
                                oConfig.valueField,

                            filterProperty:
                                oConfig.valueField
                        })
                    );

                    /*
                     * Description column.
                     */
                    if (
                        oConfig.descriptionField
                    ) {

                        oTable.addColumn(
                            new UI5TableColumn({
                                label:
                                    new Label({
                                        text:
                                            "Description"
                                    }),

                                template:
                                    new Text({
                                        text:
                                            "{" +
                                            oConfig.descriptionField +
                                            "}"
                                    }),

                                sortProperty:
                                    oConfig.descriptionField,

                                filterProperty:
                                    oConfig.descriptionField
                            })
                        );
                    }

                    /*
                     * Bind to OData Value Help entity.
                     */
                    oTable.bindRows({
                        path:
                            "/" +
                            oConfig.entity
                    });

                    oDialog.setTable(
                        oTable
                    );
                },


                /**
                 * Opens/reopens a value help dialog and applies current value.
                 */
                _openExistingValueHelp: function (
                    oInput,
                    sFilterKey,
                    oConfig
                ) {

                    var oDialog =
                        this._mValueHelpDialogs[
                        sFilterKey
                        ];

                    if (!oDialog) {
                        return;
                    }

                    /*
                     * Store current source control.
                     */
                    oDialog.data(
                        "salesOrderInput",
                        oInput
                    );

                    /*
                     * Restore currently entered tokens.
                     */
                    if (
                        typeof oInput.getTokens ===
                        "function"
                    ) {

                        var aTokens =
                            oInput.getTokens();

                        if (aTokens &&
                            aTokens.length) {

                            oDialog.setTokens(
                                aTokens
                            );
                        } else {

                            oDialog.setTokens([]);
                        }

                    } else {

                        var sValue =
                            typeof oInput.getValue ===
                                "function"
                                ? oInput.getValue()
                                : "";

                        if (sValue) {

                            var Token =
                                sap.m.Token;

                            oDialog.setTokens([
                                new Token({
                                    key: sValue,
                                    text: sValue
                                })
                            ]);

                        } else {

                            oDialog.setTokens([]);
                        }
                    }

                    oDialog.open();
                },


                /**
                 * Handles OK from ValueHelpDialog.
                 */
                _onValueHelpOk: function (
                    oEvent,
                    oInput,
                    sFilterKey,
                    oConfig
                ) {

                    var aTokens =
                        oEvent.getParameter(
                            "tokens"
                        ) || [];

                    /*
                     * MultiInput generated by SmartFilterBar.
                     */
                    if (
                        typeof oInput.setTokens ===
                        "function"
                    ) {

                        oInput.setTokens(
                            aTokens
                        );

                    } else if (
                        typeof oInput.setValue ===
                        "function"
                    ) {

                        /*
                         * Normal Input.
                         */
                        if (aTokens.length) {

                            oInput.setValue(
                                aTokens[0].getKey() ||
                                aTokens[0].getText() ||
                                ""
                            );

                        } else {

                            oInput.setValue("");
                        }
                    }

                    var oDialog =
                        this._mValueHelpDialogs[
                        sFilterKey
                        ];

                    if (oDialog) {
                        oDialog.close();
                    }

                    this._updateFilterSummary();
                },


                // =====================================================================
                // Search
                // =====================================================================

                onSearch: function (oEvent) {

                    if (!this._validateSelectionCriteria()) {

                        if (
                            oEvent &&
                            oEvent.preventDefault
                        ) {
                            oEvent.preventDefault();
                        }

                        return;
                    }

                    this._updateFilterSummary();

                    var oPage =
                        this.byId(
                            "salesOrderOverviewPage"
                        );

                    if (oPage) {
                        oPage.setHeaderExpanded(false);
                    }
                },


                _validateSelectionCriteria: function () {

                    var oFilterBar =
                        this._getFilterBar();

                    if (
                        !oFilterBar ||
                        !oFilterBar.verifySearchAllowed
                    ) {
                        return true;
                    }

                    var oResult =
                        oFilterBar.verifySearchAllowed() ||
                        {};

                    if (oResult.mandatory) {

                        MessageBox.error(
                            this.getText(
                                "filterMandatoryMissing"
                            )
                        );

                        return false;
                    }

                    if (oResult.error) {

                        MessageBox.error(
                            this.getText(
                                "filterValuesInvalid"
                            )
                        );

                        return false;
                    }

                    if (oResult.pending) {

                        MessageToast.show(
                            this.getText(
                                "filterValidationPending"
                            )
                        );

                        return false;
                    }

                    return true;
                },


                onClearFilters: function () {

                    var oFilterBar =
                        this._getFilterBar();

                    if (oFilterBar) {
                        oFilterBar.clear();
                    }

                    this._updateFilterSummary();
                },


                onFilterChange: function () {

                    this._updateFilterSummary();
                },


                _updateFilterSummary: function () {

                    var oFilterBar =
                        this._getFilterBar();

                    if (!oFilterBar) {
                        return;
                    }

                    var sSummary = "";

                    if (
                        oFilterBar
                            .retrieveFiltersWithValuesAsTextByGroup
                    ) {

                        sSummary =
                            oFilterBar
                                .retrieveFiltersWithValuesAsTextByGroup();
                    }

                    this.getModel("view").setProperty(
                        "/filterSummary",
                        sSummary ||
                        this.getText("filterHint")
                    );
                },


                // =====================================================================
                // Variant Management
                // =====================================================================

                onVariantInitialised: function () {

                    this._setupValueHelps();

                    this._updateFilterSummary();
                },


                onVariantSelected: function () {

                    /*
                     * SmartFilterBar may recreate controls after
                     * variant selection, therefore reconnect VHs.
                     */
                    this._setupValueHelps();

                    if (!this._validateSelectionCriteria()) {
                        return;
                    }

                    this._updateFilterSummary();
                },


                onVariantSaved: function () {

                    this._updateFilterSummary();

                    MessageToast.show(
                        this.getText(
                            "variantSaved"
                        )
                    );
                },


                // =====================================================================
                // SmartTable
                // =====================================================================

                onBeforeRebindTable: function (oEvent) {

                    var oBindingParams =
                        oEvent.getParameter(
                            "bindingParams"
                        );

                    oBindingParams.parameters =
                        oBindingParams.parameters || {};

                    var sSelect =
                        oBindingParams.parameters.select ||
                        "";

                    var aSelect =
                        sSelect
                            ? sSelect.split(",")
                            : [];

                    [
                        "hpSalesOrder",
                        "lineId",
                        "lineStatus",
                        "customerCode",
                        "customerDescription",
                        "hpPartNumber",
                        "hpPartDescription",
                        "customerPartNumber",
                        "quantity",
                        "quantityUnit",
                        "plannedReceiptDate",
                        "confirmedQuantity",
                        "confirmedReceiptDate",
                        "hpPurchaseOrder",
                        "hpPoLineItem",
                        "soOrderDate",
                        "customerOrder",
                        "wbsProjectCode",
                        "businessUnit",
                        "hpSalesOrganization"
                    ].forEach(
                        function (sField) {

                            if (
                                aSelect.indexOf(
                                    sField
                                ) === -1
                            ) {

                                aSelect.push(
                                    sField
                                );
                            }
                        }
                    );

                    if (aSelect.length) {

                        oBindingParams
                            .parameters
                            .select =
                            aSelect.join(",");
                    }

                    this._clearSelection();
                },


                onSmartTableInitialised: function () {

                    this._updateSelectionText();
                },


                // =====================================================================
                // Selection
                // =====================================================================

                onSelectionChange: function () {

                    this._updateSelectionText();
                },


                _updateSelectionText: function () {

                    var aKeys =
                        this._getSelectedKeys();

                    var oViewModel =
                        this.getModel("view");

                    oViewModel.setProperty(
                        "/selectedCount",
                        aKeys.length
                    );

                    oViewModel.setProperty(
                        "/selectionText",
                        aKeys.length
                            ? this.getText(
                                "selectedCount",
                                [aKeys.length]
                            )
                            : ""
                    );
                },


                _clearSelection: function () {

                    var oTable =
                        this.byId(
                            "salesOrderTable"
                        );

                    if (
                        oTable &&
                        oTable.clearSelection
                    ) {

                        oTable.clearSelection();
                    }

                    this._updateSelectionText();
                },


                _getSelectedKeys: function () {

                    var oTable =
                        this.byId(
                            "salesOrderTable"
                        );

                    if (
                        !oTable ||
                        !oTable.getSelectedIndices
                    ) {
                        return [];
                    }

                    return oTable
                        .getSelectedIndices()
                        .map(
                            function (iIndex) {

                                var oContext =
                                    oTable
                                        .getContextByIndex(
                                            iIndex
                                        );

                                if (!oContext) {
                                    return null;
                                }

                                return (
                                    oContext.getProperty(
                                        "hpSalesOrder"
                                    ) +
                                    "/" +
                                    oContext.getProperty(
                                        "lineId"
                                    )
                                );
                            }
                        )
                        .filter(Boolean);
                },


                // =====================================================================
                // Navigation
                // =====================================================================

                onSalesOrderLinkPress: function (
                    oEvent
                ) {

                    var oContext =
                        oEvent
                            .getSource()
                            .getBindingContext();

                    if (!oContext) {
                        return;
                    }

                    var sSalesOrder =
                        oContext.getProperty(
                            "hpSalesOrder"
                        );

                    this.navToSalesOrder(
                        sSalesOrder
                    );
                },


                onResultRowPress: function (
                    oEvent
                ) {

                    var oSource =
                        oEvent.getSource();

                    var oContext =
                        oSource.getBindingContext();

                    if (!oContext) {
                        return;
                    }

                    var sSalesOrder =
                        oContext.getProperty(
                            "hpSalesOrder"
                        );

                    var sLineId =
                        oContext.getProperty(
                            "lineId"
                        );

                    if (sLineId) {

                        this.getRouter().navTo(
                            "salesOrderItemDetail",
                            {
                                salesOrder:
                                    sSalesOrder,

                                lineId:
                                    sLineId
                            }
                        );

                        return;
                    }

                    this.navToSalesOrder(
                        sSalesOrder
                    );
                },


                // =====================================================================
                // Sales Order Actions
                // =====================================================================

                onUpdateSalesOrder: function (
                    oEvent
                ) {

                    var oContext =
                        oEvent
                            .getSource()
                            .getBindingContext();

                    if (!oContext) {
                        return;
                    }

                    this.openLineDialog(
                        "UpdateSalesOrderDialog",
                        "_pUpdateSalesOrderDialog",
                        new JSONModel({

                            hpSalesOrder:
                                oContext.getProperty(
                                    "hpSalesOrder"
                                ),

                            lineId:
                                oContext.getProperty(
                                    "lineId"
                                ),

                            customerOrder:
                                oContext.getProperty(
                                    "customerOrder"
                                ),

                            hpPartNumber:
                                oContext.getProperty(
                                    "hpPartNumber"
                                ),

                            hpPartDescription:
                                oContext.getProperty(
                                    "hpPartDescription"
                                ),

                            quantity:
                                oContext.getProperty(
                                    "quantity"
                                ),

                            quantityUnit:
                                oContext.getProperty(
                                    "quantityUnit"
                                ),

                            plannedReceiptDate:
                                oContext.getProperty(
                                    "plannedReceiptDate"
                                ),

                            customerPartNumber:
                                oContext.getProperty(
                                    "customerPartNumber"
                                ),

                            hpPurchaseOrder:
                                oContext.getProperty(
                                    "hpPurchaseOrder"
                                ),

                            hpPoLineItem:
                                oContext.getProperty(
                                    "hpPoLineItem"
                                )
                        })
                    );
                },


                onCancelLine: function (
                    oEvent
                ) {

                    var oContext =
                        oEvent
                            .getSource()
                            .getBindingContext();

                    if (!oContext) {
                        return;
                    }

                    this.openLineDialog(
                        "CancelLineDialog",
                        "_pCancelLineDialog",
                        new JSONModel({

                            hpSalesOrder:
                                oContext.getProperty(
                                    "hpSalesOrder"
                                ),

                            lineId:
                                oContext.getProperty(
                                    "lineId"
                                ),

                            hpPartNumber:
                                oContext.getProperty(
                                    "hpPartNumber"
                                ),

                            reasonForCancellation:
                                ""
                        })
                    );
                },


                onConfirmUpdateSalesOrder: function () {

                    var oData =
                        this.getModel("line")
                            .getData();

                    if (
                        !oData.hpSalesOrder ||
                        !oData.lineId
                    ) {

                        MessageBox.error(
                            this.getText(
                                "salesOrderRequired"
                            )
                        );

                        return;
                    }

                    this._callSalesOrderAction(
                        "updateSalesOrder",
                        {},
                        "_pUpdateSalesOrderDialog"
                    );
                },


                onConfirmCancelLine: function () {

                    var oData =
                        this.getModel("line")
                            .getData();

                    if (
                        !oData.reasonForCancellation
                    ) {

                        MessageBox.error(
                            this.getText(
                                "reasonForCancellationRequired"
                            )
                        );

                        return;
                    }

                    this._callSalesOrderAction(
                        "cancelLine",
                        {
                            reasonForCancellation:
                                oData.reasonForCancellation
                        },
                        "_pCancelLineDialog"
                    );
                },


                onCancelUpdateSalesOrder: function () {

                    this.closeLineDialog(
                        "_pUpdateSalesOrderDialog"
                    );
                },


                onCancelCancelLine: function () {

                    this.closeLineDialog(
                        "_pCancelLineDialog"
                    );
                },


                // =====================================================================
                // Sales Order Action Invocation
                // =====================================================================

                _callSalesOrderAction: function (
                    sAction,
                    oPayload,
                    sDialogKey
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
                                    oResult.message ||
                                    this.getText(
                                        "actionCompleted"
                                    )
                                );

                                if (sDialogKey) {

                                    this.closeLineDialog(
                                        sDialogKey
                                    );
                                }

                                this._rebindTable();

                            }.bind(this)
                        )

                        .catch(
                            function (oError) {

                                MessageBox.error(
                                    oError.message ||
                                    this.getText(
                                        "actionFailed"
                                    )
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


                // =====================================================================
                // Export
                // =====================================================================

                onOpenExportDialog: function () {

                    var oView =
                        this.getView();

                    var aSelectedKeys =
                        this._getSelectedKeys();

                    var iTotal =
                        this._getRowCount();

                    var iPageSize =
                        this._getLoadedRowCount();

                    this.setModel(
                        new JSONModel({

                            formatIndex: 0,

                            layoutIndex: 0,

                            scopeIndex:
                                aSelectedKeys.length
                                    ? 2
                                    : 0,

                            selectedCount:
                                aSelectedKeys.length,

                            scopeAllText:
                                this.getText(
                                    "exportScopeAll",
                                    [iTotal]
                                ),

                            scopePageText:
                                this.getText(
                                    "exportScopePage",
                                    [iPageSize]
                                ),

                            scopeSelectedText:
                                this.getText(
                                    "exportScopeSelected",
                                    [
                                        aSelectedKeys.length
                                    ]
                                )
                        }),
                        "exportDialog"
                    );

                    if (!this._pExportDialog) {

                        this._pExportDialog =
                            Fragment.load({

                                id:
                                    oView.getId(),

                                name:
                                    "hpbuysell.otc.salesorder.ui.view.fragment.OverviewExportDialog",

                                controller:
                                    this

                            }).then(
                                function (oDialog) {

                                    oView.addDependent(
                                        oDialog
                                    );

                                    return oDialog;
                                }
                            );
                    }

                    this._pExportDialog.then(
                        function (oDialog) {

                            oDialog.open();

                        }
                    );
                },


                onCancelExport: function () {

                    if (this._pExportDialog) {

                        this._pExportDialog.then(
                            function (oDialog) {

                                oDialog.close();

                            }
                        );
                    }
                },


                onConfirmExport: function () {

                    var oDialogModel =
                        this.getModel(
                            "exportDialog"
                        );

                    var oViewModel =
                        this.getModel(
                            "view"
                        );

                    var sFormat =
                        FORMATS[
                        oDialogModel.getProperty(
                            "/formatIndex"
                        )
                        ] || "XLSX";

                    var sLayout =
                        LAYOUTS[
                        oDialogModel.getProperty(
                            "/layoutIndex"
                        )
                        ] || "SEARCHRESULT";

                    var sScope =
                        SCOPES[
                        oDialogModel.getProperty(
                            "/scopeIndex"
                        )
                        ] || "ALL";

                    var oQuery =
                        this._getCurrentQuery();

                    var oPayload = {

                        filter:
                            oQuery.filter,

                        search:
                            oQuery.search,

                        format:
                            sFormat,

                        layout:
                            sLayout,

                        scope:
                            sScope,

                        selectedKeys:
                            sScope === "SELECTED"
                                ? this
                                    ._getSelectedKeys()
                                    .join(",")
                                : "",

                        skip: 0,

                        top:
                            sScope === "PAGE"
                                ? this
                                    ._getLoadedRowCount()
                                : 0
                    };

                    oViewModel.setProperty(
                        "/exportBusy",
                        true
                    );

                    this.postJson(
                        this.getServiceUrl() +
                        "exportSearchResults",
                        oPayload
                    )

                        .then(
                            function (oResponse) {

                                if (!oResponse.ok) {

                                    throw new Error(
                                        "HTTP " +
                                        oResponse.status
                                    );
                                }

                                this._sExportFileName =
                                    this._readFileName(
                                        oResponse.headers.get(
                                            "Content-Disposition"
                                        ),
                                        sFormat,
                                        sLayout
                                    );

                                return oResponse.blob();

                            }.bind(this)
                        )

                        .then(
                            function (oBlob) {

                                this._saveBlob(
                                    oBlob,
                                    this._sExportFileName
                                );

                                MessageToast.show(
                                    this.getText(
                                        "exportStarted"
                                    )
                                );

                                this.onCancelExport();

                            }.bind(this)
                        )

                        .catch(
                            function (oError) {

                                MessageBox.error(
                                    this.getText(
                                        "exportFailed",
                                        [
                                            oError.message
                                        ]
                                    )
                                );

                            }.bind(this)
                        )

                        .finally(
                            function () {

                                oViewModel.setProperty(
                                    "/exportBusy",
                                    false
                                );

                            }.bind(this)
                        );
                },


                // =====================================================================
                // Export Helpers
                // =====================================================================

                _getCurrentQuery: function () {

                    var oBinding =
                        this._getTableBinding();

                    var oResult = {
                        filter: "",
                        search: ""
                    };

                    if (!oBinding) {
                        return oResult;
                    }

                    try {

                        if (
                            typeof oBinding
                                .getDownloadUrl ===
                            "function"
                        ) {

                            var oUrl =
                                new URL(
                                    oBinding.getDownloadUrl(),
                                    window.location.origin
                                );

                            oResult.filter =
                                oUrl.searchParams.get(
                                    "$filter"
                                ) || "";

                            oResult.search =
                                oUrl.searchParams.get(
                                    "$search"
                                ) ||
                                oUrl.searchParams.get(
                                    "search"
                                ) ||
                                "";
                        }

                    } catch (oError) {

                        oResult.filter = "";
                    }

                    if (!oResult.search) {

                        var oFilterBar =
                            this._getFilterBar();

                        oResult.search =
                            (
                                oFilterBar &&
                                oFilterBar.getBasicSearchValue
                            )
                                ?
                                (
                                    oFilterBar
                                        .getBasicSearchValue() ||
                                    ""
                                )
                                :
                                "";
                    }

                    return oResult;
                },


                _readFileName: function (
                    sContentDisposition,
                    sFormat,
                    sLayout
                ) {

                    var aMatch =
                        /filename\s*=\s*"?([^";]+)"?/i
                            .exec(
                                sContentDisposition || ""
                            );

                    return (
                        aMatch &&
                        aMatch[1].trim()
                    ) ||

                        (
                            sLayout === "SUMMARY"
                                ? "SalesOrderSummary."
                                : "SalesOrderSearchResult."
                        ) +

                        (
                            sFormat === "CSV"
                                ? "csv"
                                : "xlsx"
                        );
                },


                _saveBlob: function (
                    oBlob,
                    sFileName
                ) {

                    var sUrl =
                        window.URL.createObjectURL(
                            oBlob
                        );

                    var oLink =
                        document.createElement("a");

                    oLink.href = sUrl;

                    oLink.download =
                        sFileName;

                    document.body.appendChild(
                        oLink
                    );

                    oLink.click();

                    document.body.removeChild(
                        oLink
                    );

                    window.URL.revokeObjectURL(
                        sUrl
                    );
                },


                // =====================================================================
                // Navigation
                // =====================================================================

                onNavToSummary: function () {

                    this.getRouter().navTo(
                        "salesOrderSummary"
                    );
                },


                // =====================================================================
                // Helpers
                // =====================================================================

                _getFilterBar: function () {

                    return this.byId(
                        "salesOrderSmartFilterBar"
                    );
                },


                _getSmartTable: function () {

                    return this.byId(
                        "salesOrderSmartTable"
                    );
                },


                _rebindTable: function () {

                    var oSmartTable =
                        this._getSmartTable();

                    if (
                        oSmartTable &&
                        oSmartTable.rebindTable
                    ) {

                        oSmartTable.rebindTable();
                    }
                },


                _getInnerTable: function () {

                    return this.byId(
                        "salesOrderTable"
                    );
                },


                _getTableBinding: function () {

                    var oTable =
                        this._getInnerTable();

                    return (
                        oTable &&
                        oTable.getBinding("rows")
                    );
                },


                _getRowCount: function () {

                    var oBinding =
                        this._getTableBinding();

                    return oBinding
                        ? (
                            oBinding.getLength() ||
                            0
                        )
                        : 0;
                },


                _getLoadedRowCount: function () {

                    var oTable =
                        this._getInnerTable();

                    if (
                        !oTable ||
                        !oTable.getVisibleRowCount
                    ) {
                        return 0;
                    }

                    return Math.min(
                        oTable.getVisibleRowCount(),
                        this._getRowCount()
                    );
                }

            }
        );
    }
);