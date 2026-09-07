// -----------------------------------------------------------------------------------*
// Confidential and Proprietary
// Copyright 2026, HP
// All Rights Reserved
// -----------------------------------------------------------------------------------*
// Application Name :    Sales Order
// Module           :    Detail Controller
// Namespace        :    hpbuysell.otc.salesorder
// Description      :    SalesOrderDetail.controller.js
// -----------------------------------------------------------------------------------*

sap.ui.define(
    [
        "hpbuysell/otc/salesorder/ui/controller/BaseController",
        "hpbuysell/otc/salesorder/ui/model/formatter",
        "sap/ui/model/json/JSONModel",
        "sap/ui/model/Filter",
        "sap/ui/model/FilterOperator",
        "sap/m/MessageBox",
        "sap/m/MessageToast"
    ],
    function (
        BaseController,
        formatter,
        JSONModel,
        Filter,
        FilterOperator,
        MessageBox,
        MessageToast
    ) {
        "use strict";

        // =====================================================================
        // CONTROLLER
        // =====================================================================

        return BaseController.extend(
            "hpbuysell.otc.salesorder.ui.controller.SalesOrderDetail",
            {

                formatter: formatter,

                // =============================================================
                // INIT
                // =============================================================

                onInit: function () {

                    this._sSalesOrderNumber = "";
                    this._sHeaderNotesBackup = "";

                    // Change History state
                    this._sChangeQuery = "";
                    this._sChangeScope = "ALL";

                    this._mOriginalLineValues = {};

                    this.setModel(
                        new JSONModel({
                            busy: true,
                            actionBusy: false,

                            selectedLines: {},

                            itemsEditMode: false,
                            itemsEditable: false,

                            itemsCancelMode: false,
                            itemsCancellable: false,

                            itemsHistoryEnabled: false,

                            selectedTab: "overview",

                            itemTitle:
                                this.getText("items"),

                            changeTitle:
                                this.getText("changeHistory"),

                            itemCount: "",
                            changeCount: "",
                            attachmentCount: "",

                            headerNoteEditMode: false,
                            headerNoteDraft: ""
                        }),
                        "view"
                    );

                    this.getRouter()
                        .getRoute("salesOrderDetail")
                        .attachPatternMatched(
                            this._onRouteMatched,
                            this
                        );
                },

                // =============================================================
                // ROUTE
                // =============================================================

                _onRouteMatched: function (oEvent) {

                    var oArgs =
                        oEvent.getParameter("arguments");

                    this._sHpSalesOrder =
                        decodeURIComponent(
                            oArgs.salesOrder
                        );

                    var oViewModel =
                        this.getModel("view");

                    oViewModel.setProperty(
                        "/busy",
                        true
                    );

                    oViewModel.setProperty(
                        "/selectedTab",
                        "overview"
                    );

                    this._mOriginalLineValues = {};

                    this._leaveEditMode();

                    this._leaveHeaderNoteEditMode();

                    this.getView().bindElement({

                        path:
                            this.buildSalesOrderPath(
                                this._sHpSalesOrder
                            ),

                        events: {

                            change:
                                this._onBindingChange.bind(
                                    this
                                ),

                            dataRequested:
                                function () {

                                    oViewModel.setProperty(
                                        "/busy",
                                        true
                                    );
                                },

                            dataReceived:
                                function (oDataEvent) {

                                    oViewModel.setProperty(
                                        "/busy",
                                        false
                                    );

                                    if (
                                        !oDataEvent.getParameter(
                                            "data"
                                        )
                                    ) {
                                        this._showNotFound();
                                    }

                                }.bind(this)
                        }
                    });
                },

                _onBindingChange: function () {

                    var oBinding =
                        this.getView()
                            .getElementBinding();

                    this.getModel("view")
                        .setProperty(
                            "/busy",
                            false
                        );

                    if (
                        oBinding &&
                        !oBinding.getBoundContext()
                    ) {
                        this._showNotFound();
                    }
                },

                _showNotFound: function () {

                    this.getRouter()
                        .getTargets()
                        .display("notFound");
                },

                // =============================================================
                // REFRESH
                // =============================================================

                onRefresh: function () {

                    this._refreshDocument();
                },

                _refreshDocument: function () {

                    var oElementBinding =
                        this.getView()
                            .getElementBinding();

                    if (
                        oElementBinding &&
                        oElementBinding.refresh
                    ) {
                        oElementBinding.refresh(true);
                    }

                    var oItemTable =
                        this.byId("soItemTable");

                    if (oItemTable) {

                        var oRowsBinding =
                            oItemTable.getBinding("rows");

                        if (
                            oRowsBinding &&
                            oRowsBinding.refresh
                        ) {
                            oRowsBinding.refresh(true);
                        }
                    }

                    var oAttachmentTable =
                        this.byId("soAttachmentTable");

                    if (oAttachmentTable) {

                        var oAttachmentBinding =
                            oAttachmentTable.getBinding("items");

                        if (
                            oAttachmentBinding &&
                            oAttachmentBinding.refresh
                        ) {
                            oAttachmentBinding.refresh(true);
                        }
                    }
                },

                // =============================================================
                // TAB
                // =============================================================

                onTabSelect: function (oEvent) {

                    this.getModel("view")
                        .setProperty(
                            "/selectedTab",
                            oEvent.getParameter("key")
                        );
                },

                // =============================================================
                // ITEM SEARCH
                // =============================================================

                onItemSearch: function (oEvent) {

                    var sQuery =
                        (
                            oEvent.getParameter("query") ||
                            ""
                        ).trim();

                    var oTable =
                        this.byId("soItemTable");

                    if (!oTable) {
                        return;
                    }

                    var oBinding =
                        oTable.getBinding("rows");

                    if (!oBinding) {
                        return;
                    }

                    if (!sQuery) {

                        oBinding.filter([]);

                        return;
                    }

                    var aFilters = [

                        new Filter(
                            "lineId",
                            FilterOperator.Contains,
                            sQuery
                        ),

                        new Filter(
                            "hpPartNumber",
                            FilterOperator.Contains,
                            sQuery
                        ),

                        new Filter(
                            "hpPartDescription",
                            FilterOperator.Contains,
                            sQuery
                        ),

                        new Filter(
                            "customerPartNumber",
                            FilterOperator.Contains,
                            sQuery
                        )
                    ];

                    oBinding.filter(
                        new Filter({
                            filters: aFilters,
                            and: false
                        })
                    );
                },

                // =============================================================
                // SELECTION
                // =============================================================

                onItemSelectionChange: function (oEvent) {

                    this._syncSelectedLines();
                },

                _syncSelectedLines: function () {

                    var oTable =
                        this.byId("soItemTable");

                    var oViewModel =
                        this.getModel("view");

                    if (!oTable) {
                        return;
                    }

                    var aIndices =
                        oTable.getSelectedIndices();

                    var oSelected = {};

                    var bAnyEditable = false;
                    var bAnyCancellable = false;

                    aIndices.forEach(
                        function (iIndex) {

                            var oContext =
                                oTable.getContextByIndex(
                                    iIndex
                                );

                            if (!oContext) {
                                return;
                            }

                            var sLineId =
                                oContext.getProperty(
                                    "lineId"
                                );

                            var sStatus =
                                oContext.getProperty(
                                    "lineStatus_code"
                                );

                            if (sLineId) {
                                oSelected[sLineId] = true;
                            }

                            if (
                                !formatter.isCancelledStatus(
                                    sStatus
                                )
                            ) {
                                bAnyEditable = true;
                            }

                            if (
                                formatter.isCancellableStatus(
                                    sStatus
                                )
                            ) {
                                bAnyCancellable = true;
                            }
                        }
                    );

                    oViewModel.setProperty(
                        "/selectedLines",
                        oSelected
                    );

                    oViewModel.setProperty(
                        "/itemsEditable",
                        bAnyEditable
                    );

                    oViewModel.setProperty(
                        "/itemsCancellable",
                        bAnyCancellable
                    );

                    oViewModel.setProperty(
                        "/itemsHistoryEnabled",
                        aIndices.length === 1
                    );

                    console.log(
                        "Selected rows:",
                        aIndices
                    );

                    console.log(
                        "Selected lines:",
                        oSelected
                    );
                },

                _getSelectedItemContexts: function () {

                    var oTable =
                        this.byId("soItemTable");

                    if (!oTable) {

                        console.error(
                            "ERROR: soItemTable not found"
                        );

                        return [];
                    }

                    var aIndices =
                        oTable.getSelectedIndices();

                    return aIndices
                        .map(
                            function (iIndex) {
                                return oTable
                                    .getContextByIndex(
                                        iIndex
                                    );
                            }
                        )
                        .filter(Boolean);
                },

                // =============================================================
                // EDIT ITEMS
                // =============================================================

                onEditItems: function () {

                    var oTable =
                        this.byId("soItemTable");

                    var oViewModel =
                        this.getModel("view");

                    if (!oTable) {

                        MessageBox.error(
                            "Sales Order item table not found."
                        );

                        return;
                    }

                    var aContexts =
                        this._getSelectedItemContexts();

                    if (!aContexts.length) {

                        MessageToast.show(
                            this.getText(
                                "selectLineToEdit"
                            )
                        );

                        return;
                    }

                    /*
                     * IMPORTANT:
                     * Capture the original values BEFORE
                     * entering edit mode.
                     */
                    this._captureOriginalLineValues();

                    oViewModel.setProperty(
                        "/itemsEditMode",
                        true
                    );

                    oViewModel.setProperty(
                        "/itemsCancelMode",
                        false
                    );

                    console.log(
                        "EDIT MODE ENABLED"
                    );

                    console.log(
                        "Original values:",
                        this._mOriginalLineValues
                    );
                },

                // =============================================================
                // CAPTURE ORIGINAL VALUES
                // =============================================================

                _captureOriginalLineValues: function () {

                    this._mOriginalLineValues = {};

                    var aContexts =
                        this._getSelectedItemContexts();

                    aContexts.forEach(
                        function (oContext) {

                            var sLineId =
                                oContext.getProperty(
                                    "lineId"
                                );

                            if (!sLineId) {
                                return;
                            }

                            this._mOriginalLineValues[sLineId] = {

                                salesPrice:
                                    oContext.getProperty(
                                        "salesPrice"
                                    ),

                                salesPriceUnit:
                                    oContext.getProperty(
                                        "salesPriceUnit"
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
                                    )
                            };



                        }.bind(this)
                    );
                },

                // =============================================================
                // FORCE MODEL UPDATE FROM INPUT
                // =============================================================

                onSalesPriceChange: function (oEvent) {

                    var oInput =
                        oEvent.getSource();

                    var oContext =
                        oInput.getBindingContext();

                    if (!oContext) {
                        return;
                    }

                    var vValue =
                        oInput.getValue();

                    var fValue =
                        parseFloat(vValue);

                    if (isNaN(fValue)) {
                        return;
                    }

                    oContext.setProperty(
                        "salesPrice",
                        fValue
                    );

                    console.log(
                        "Sales Price changed:",
                        oContext.getProperty(
                            "lineId"
                        ),
                        fValue
                    );
                },

                onSalesPriceLiveChange:
                    function (oEvent) {

                        var oInput =
                            oEvent.getSource();

                        var oContext =
                            oInput.getBindingContext();

                        if (!oContext) {
                            return;
                        }

                        var vValue =
                            oInput.getValue();

                        if (
                            vValue === "" ||
                            vValue === null
                        ) {
                            return;
                        }

                        var fValue =
                            parseFloat(vValue);

                        if (isNaN(fValue)) {
                            return;
                        }

                        /*
                         * Force the OData V4 context to
                         * receive the current UI value.
                         */
                        oContext.setProperty(
                            "salesPrice",
                            fValue
                        );
                    },

                onspecialDealFlagSoChange:
                    function (oEvent) {

                        var oSelect =
                            oEvent.getSource();

                        var oContext =
                            oSelect.getBindingContext();

                        if (!oContext) {
                            return;
                        }

                        var sValue =
                            oSelect.getSelectedKey();

                        oContext.setProperty(
                            "specialDealFlagSo",
                            sValue
                        );

                        console.log(
                            "Special Deal Flag changed:",
                            sValue
                        );
                    },

                onSalesPriceUnitChange:
                    function (oEvent) {

                        var oSelect =
                            oEvent.getSource();

                        var oContext =
                            oSelect.getBindingContext();

                        if (!oContext) {
                            return;
                        }

                        var sValue =
                            oSelect.getSelectedKey();

                        oContext.setProperty(
                            "salesPriceUnit",
                            sValue
                        );

                        console.log(
                            "Sales Price Unit changed:",
                            sValue
                        );
                    },

                onHpNotesChange:
                    function (oEvent) {

                        var oInput =
                            oEvent.getSource();

                        var oContext =
                            oInput.getBindingContext();

                        if (!oContext) {
                            return;
                        }

                        oContext.setProperty(
                            "hpNotesToCustomer",
                            oInput.getValue()
                        );
                    },

                onBacklogNotesChange:
                    function (oEvent) {

                        var oInput =
                            oEvent.getSource();

                        var oContext =
                            oInput.getBindingContext();

                        if (!oContext) {
                            return;
                        }

                        oContext.setProperty(
                            "hpBacklogNotes",
                            oInput.getValue()
                        );
                    },

                // =============================================================
                // CANCEL EDIT
                // =============================================================

                onCancelItemsEdit: function () {

                    this._restoreOriginalLineValues();

                    this._leaveEditMode();

                    MessageToast.show(
                        this.getText(
                            "changesDiscarded"
                        )
                    );
                },

                _restoreOriginalLineValues:
                    function () {

                        var aContexts =
                            this._getSelectedItemContexts();

                        aContexts.forEach(
                            function (oContext) {

                                var sLineId =
                                    oContext.getProperty(
                                        "lineId"
                                    );

                                var oOriginal =
                                    this._mOriginalLineValues[
                                    sLineId
                                    ];

                                if (!oOriginal) {
                                    return;
                                }

                                oContext.setProperty(
                                    "salesPrice",
                                    oOriginal.salesPrice
                                );

                                oContext.setProperty(
                                    "salesPriceUnit",
                                    oOriginal.salesPriceUnit
                                );

                                oContext.setProperty(
                                    "specialDealFlagSo",
                                    oOriginal.specialDealFlagSo
                                );

                                oContext.setProperty(
                                    "hpNotesToCustomer",
                                    oOriginal.hpNotesToCustomer
                                );

                                oContext.setProperty(
                                    "hpBacklogNotes",
                                    oOriginal.hpBacklogNotes
                                );
                            }.bind(this)
                        );
                    },

                _leaveEditMode: function () {

                    var oTable =
                        this.byId("soItemTable");

                    if (
                        oTable &&
                        oTable.clearSelection
                    ) {
                        oTable.clearSelection();
                    }

                    var oViewModel =
                        this.getModel("view");

                    oViewModel.setProperty(
                        "/itemsEditMode",
                        false
                    );

                    oViewModel.setProperty(
                        "/itemsEditable",
                        false
                    );

                    oViewModel.setProperty(
                        "/itemsCancelMode",
                        false
                    );

                    oViewModel.setProperty(
                        "/itemsCancellable",
                        false
                    );

                    oViewModel.setProperty(
                        "/itemsHistoryEnabled",
                        false
                    );

                    oViewModel.setProperty(
                        "/selectedLines",
                        {}
                    );

                    this._mOriginalLineValues = {};
                },

                // =============================================================
                // CHANGE DETECTION
                // =============================================================

                _valueChanged: function (
                    vCurrent,
                    vOriginal,
                    sType
                ) {

                    if (sType === "number") {

                        var fCurrent =
                            parseFloat(vCurrent);

                        var fOriginal =
                            parseFloat(vOriginal);

                        /*
                         * Both empty/null.
                         */
                        if (
                            (
                                vCurrent === null ||
                                vCurrent === undefined ||
                                vCurrent === ""
                            ) &&
                            (
                                vOriginal === null ||
                                vOriginal === undefined ||
                                vOriginal === ""
                            )
                        ) {
                            return false;
                        }

                        /*
                         * One is empty and the other isn't.
                         */
                        if (
                            isNaN(fCurrent) !==
                            isNaN(fOriginal)
                        ) {
                            return true;
                        }

                        if (
                            !isNaN(fCurrent) &&
                            !isNaN(fOriginal)
                        ) {
                            return (
                                Math.round(
                                    fCurrent * 1000
                                ) !==
                                Math.round(
                                    fOriginal * 1000
                                )
                            );
                        }
                    }

                    return this._asText(
                        vCurrent
                    ) !== this._asText(
                        vOriginal
                    );
                },

                _asText: function (vValue) {

                    if (
                        vValue === null ||
                        vValue === undefined
                    ) {
                        return "";
                    }

                    return String(vValue).trim();
                },

                _parseValue: function (
                    vValue,
                    sType
                ) {

                    if (sType === "string") {

                        return (
                            vValue === null ||
                            vValue === undefined
                        )
                            ? ""
                            : String(vValue);
                    }

                    if (
                        vValue === null ||
                        vValue === undefined ||
                        vValue === ""
                    ) {
                        return null;
                    }

                    return parseFloat(vValue);
                },

                // =============================================================
                // CHECK ONE LINE
                // =============================================================

                _hasLineChanges: function (
                    oContext
                ) {

                    if (!oContext) {
                        return false;
                    }

                    var sLineId =
                        oContext.getProperty(
                            "lineId"
                        );

                    var oOriginal =
                        this._mOriginalLineValues[
                        sLineId
                        ];

                    if (!oOriginal) {
                        return false;
                    }

                    var bChanged =
                        this._valueChanged(
                            oContext.getProperty(
                                "salesPrice"
                            ),
                            oOriginal.salesPrice,
                            "number"
                        ) ||
                        this._valueChanged(
                            oContext.getProperty(
                                "salesPriceUnit"
                            ),
                            oOriginal.salesPriceUnit,
                            "string"
                        ) ||
                        this._valueChanged(
                            oContext.getProperty(
                                "specialDealFlagSo"
                            ),
                            oOriginal.specialDealFlagSo,
                            "string"
                        ) ||
                        this._valueChanged(
                            oContext.getProperty(
                                "hpNotesToCustomer"
                            ),
                            oOriginal.hpNotesToCustomer,
                            "string"
                        ) ||
                        this._valueChanged(
                            oContext.getProperty(
                                "hpBacklogNotes"
                            ),
                            oOriginal.hpBacklogNotes,
                            "string"
                        );

                    return bChanged;
                },

                _hasPendingLineChanges:
                    function () {

                        return this
                            ._getSelectedItemContexts()
                            .some(
                                function (oContext) {

                                    return this
                                        ._hasLineChanges(
                                            oContext
                                        );

                                }.bind(this)
                            );
                    },

                // =============================================================
                // COLLECT CHANGES
                // =============================================================

                _collectLineChanges: function () {

                    var aChanges = [];

                    var aContexts =
                        this._getSelectedItemContexts();

                    console.log(
                        "SAVE - selected contexts:",
                        aContexts.length
                    );

                    aContexts.forEach(
                        function (oContext) {

                            var sLineId =
                                oContext.getProperty(
                                    "lineId"
                                );

                            var oOriginal =
                                this._mOriginalLineValues[
                                sLineId
                                ];

                            console.log(
                                "Checking line:",
                                sLineId
                            );

                            if (!oOriginal) {

                                console.error(
                                    "No original values for:",
                                    sLineId
                                );

                                return;
                            }

                            var vSalesPrice =
                                oContext.getProperty(
                                    "salesPrice"
                                );

                            var vSalesPriceUnit =
                                oContext.getProperty(
                                    "salesPriceUnit"
                                );

                            var vspecialDealFlagSo =
                                oContext.getProperty(
                                    "specialDealFlagSo"
                                );

                            var vHpNotes =
                                oContext.getProperty(
                                    "hpNotesToCustomer"
                                );

                            var vBacklog =
                                oContext.getProperty(
                                    "hpBacklogNotes"
                                );

                            var bPriceChanged =
                                this._valueChanged(
                                    vSalesPrice,
                                    oOriginal.salesPrice,
                                    "number"
                                );

                            var bPriceUnitChanged =
                                this._valueChanged(
                                    vSalesPriceUnit,
                                    oOriginal.salesPriceUnit,
                                    "string"
                                );

                            var bSpecialDealChanged =
                                this._valueChanged(
                                    vspecialDealFlagSo,
                                    oOriginal.specialDealFlagSo,
                                    "string"
                                );

                            var bNotesChanged =
                                this._valueChanged(
                                    vHpNotes,
                                    oOriginal.hpNotesToCustomer,
                                    "string"
                                );

                            var bBacklogChanged =
                                this._valueChanged(
                                    vBacklog,
                                    oOriginal.hpBacklogNotes,
                                    "string"
                                );

                            console.log(
                                "Original:",
                                oOriginal
                            );

                            console.log(
                                "Current:",
                                {
                                    salesPrice:
                                        vSalesPrice,

                                    salesPriceUnit:
                                        vSalesPriceUnit,

                                    specialDealFlagSo:
                                        vspecialDealFlagSo,

                                    hpNotesToCustomer:
                                        vHpNotes,

                                    hpBacklogNotes:
                                        vBacklog
                                }
                            );

                            console.log(
                                "Changed:",
                                {
                                    salesPrice:
                                        bPriceChanged,

                                    salesPriceUnit:
                                        bPriceUnitChanged,

                                    specialDealFlagSo:
                                        bSpecialDealChanged,

                                    hpNotes:
                                        bNotesChanged,

                                    backlog:
                                        bBacklogChanged
                                }
                            );

                            if (
                                !(
                                    bPriceChanged ||
                                    bPriceUnitChanged ||
                                    bSpecialDealChanged ||
                                    bNotesChanged ||
                                    bBacklogChanged
                                )
                            ) {
                                return;
                            }

                            var oPayload = {

                                salesOrder:
                                    this._sHpSalesOrder,

                                lineID:
                                    sLineId
                            };

                            if (bPriceChanged) {

                                oPayload.salesPrice =
                                    this._parseValue(
                                        vSalesPrice,
                                        "number"
                                    );
                            }

                            if (
                                bPriceUnitChanged
                            ) {

                                oPayload.salesPriceUnit =
                                    this._parseValue(
                                        vSalesPriceUnit,
                                        "string"
                                    );
                            }

                            if (
                                bSpecialDealChanged
                            ) {

                                oPayload.specialDealFlagSo =
                                    (vspecialDealFlagSo === "Y");
                            }

                            if (bNotesChanged) {

                                oPayload.hpNotesToCustomer =
                                    this._parseValue(
                                        vHpNotes,
                                        "string"
                                    );
                            }

                            if (bBacklogChanged) {

                                oPayload.hpBacklogNotes =
                                    this._parseValue(
                                        vBacklog,
                                        "string"
                                    );
                            }

                            var sValidationError =
                                this._validateItemChange({
                                    salesPriceChanged:
                                        bPriceChanged,

                                    salesPrice:
                                        vSalesPrice,

                                    salesPriceUnit:
                                        vSalesPriceUnit,

                                    specialDealFlagSo:
                                        vspecialDealFlagSo
                                });

                            aChanges.push({

                                lineId:
                                    sLineId,

                                payload:
                                    oPayload,

                                error:
                                    sValidationError
                            });

                        }.bind(this)
                    );

                    console.log(
                        "========== FINAL CHANGES ==========",
                        aChanges
                    );

                    return aChanges;
                },

                // =============================================================
                // VALIDATION
                // =============================================================

                _validateItemChange: function (
                    oLine
                ) {

                    /*
                     * Sales Price changed:
                     * Sales Price Unit required.
                     */
                    if (
                        oLine.salesPriceChanged &&
                        !oLine.salesPriceUnit
                    ) {

                        return this.getText(
                            "errorPriceUnitRequired"
                        );
                    }

                    /*
                     * Sales Price changed:
                     * Special Deal Flag must be Y.
                     */
                    if (
                        oLine.salesPriceChanged &&
                        oLine.specialDealFlagSo !== "Y"
                    ) {

                        return this.getText(
                            "errorspecialDealFlagSoRequired"
                        );
                    }

                    /*
                     * Special Deal Flag Y:
                     * Sales Price required.
                     */
                    if (
                        oLine.specialDealFlagSo === "Y" &&
                        (
                            oLine.salesPrice === null ||
                            oLine.salesPrice === undefined ||
                            oLine.salesPrice === ""
                        )
                    ) {

                        return this.getText(
                            "errorSalesPriceRequired"
                        );
                    }

                    return "";
                },

                // =============================================================
                // SAVE
                // =============================================================

                onSaveItems: function () {

                    console.log(
                        "================================"
                    );

                    console.log(
                        "SAVE BUTTON CLICKED"
                    );

                    console.log(
                        "================================"
                    );

                    /*
                     * Make sure the currently focused input
                     * has committed its value.
                     */
                    var oTable =
                        this.byId("soItemTable");

                    if (oTable) {
                        oTable.getDomRef();
                    }

                    var aChanges =
                        this._collectLineChanges();

                    if (!aChanges.length) {

                        MessageToast.show(
                            this.getText(
                                "noLineChanges"
                            )
                        );

                        return;
                    }

                    for (
                        var i = 0;
                        i < aChanges.length;
                        i++
                    ) {

                        if (aChanges[i].error) {

                            MessageBox.error(
                                this.getText(
                                    "inlineEditLineError",
                                    [
                                        aChanges[i].lineId,
                                        aChanges[i].error
                                    ]
                                )
                            );

                            return;
                        }
                    }

                    this._submitLineChanges(
                        aChanges
                    );
                },

                // =============================================================
                // SUBMIT
                // =============================================================

                _submitLineChanges: function (
                    aChanges
                ) {

                    var oViewModel =
                        this.getModel("view");

                    var aErrors = [];

                    var iSaved = 0;

                    oViewModel.setProperty(
                        "/actionBusy",
                        true
                    );

                    var pRequest =
                        aChanges.reduce(
                            function (
                                pPrevious,
                                oChange
                            ) {

                                return pPrevious.then(
                                    function () {

                                        console.log(
                                            "POST updateSalesOrderItem:",
                                            oChange.payload
                                        );

                                        return this
                                            .callLineAction(
                                                "updateSalesOrderItem",
                                                oChange.payload
                                            )
                                            .then(
                                                function (
                                                    oResponse
                                                ) {

                                                    console.log(
                                                        "Update successful:",
                                                        oResponse
                                                    );

                                                    iSaved++;
                                                }
                                            )
                                            .catch(
                                                function (
                                                    oError
                                                ) {

                                                    console.error(
                                                        "Update failed:",
                                                        oError
                                                    );

                                                    aErrors.push(
                                                        "Line " +
                                                        oChange.lineId +
                                                        ": " +
                                                        (
                                                            oError &&
                                                                oError.message
                                                                ? oError.message
                                                                : String(
                                                                    oError
                                                                )
                                                        )
                                                    );
                                                }
                                            );

                                    }.bind(this)
                                );

                            }.bind(this),
                            Promise.resolve()
                        );

                    return pRequest
                        .then(
                            function () {

                                if (iSaved > 0) {

                                    this._refreshDocument();

                                    this._leaveEditMode();

                                    MessageToast.show(
                                        this.getText(
                                            "inlineEditSaved",
                                            [iSaved]
                                        )
                                    );
                                }

                                if (aErrors.length) {

                                    MessageBox.error(
                                        aErrors.join("\n")
                                    );
                                }

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

                // =============================================================
                // LINE ACTION
                // =============================================================

                callLineAction: function (
                    sAction,
                    oPayload
                ) {

                    var sUrl =
                        this.getServiceUrl();

                    /*
                     * Ensure exactly one slash.
                     */
                    if (
                        sUrl.charAt(
                            sUrl.length - 1
                        ) !== "/"
                    ) {
                        sUrl += "/";
                    }

                    sUrl += sAction;

                    console.log(
                        "ACTION URL:",
                        sUrl
                    );

                    console.log(
                        "ACTION PAYLOAD:",
                        oPayload
                    );

                    return this.postJson(
                        sUrl,
                        oPayload
                    )
                        .then(
                            function (oResponse) {

                                return oResponse
                                    .text()
                                    .then(
                                        function (
                                            sText
                                        ) {

                                            var oBody =
                                                {};

                                            if (sText) {

                                                try {

                                                    oBody =
                                                        JSON.parse(
                                                            sText
                                                        );

                                                } catch (
                                                e
                                                ) {

                                                    oBody = {
                                                        value:
                                                            sText
                                                    };
                                                }
                                            }

                                            if (
                                                !oResponse.ok
                                            ) {

                                                var sRawMessage =
                                                    (oBody && oBody.error && oBody.error.message) ||
                                                    (oBody && oBody.message) ||
                                                    sText ||
                                                    ("HTTP " + oResponse.status);

                                                var sMessage =
                                                    (sRawMessage && typeof sRawMessage === "object" && sRawMessage.value)
                                                        ? sRawMessage.value
                                                        : sRawMessage;

                                                throw new Error(sMessage);
                                            }

                                            return oBody;
                                        }
                                    );
                            }
                        );
                },

                // =============================================================
                // HEADER ACTION
                // =============================================================

                callHeaderAction: function (
                    sAction,
                    oPayload
                ) {

                    return this.callLineAction(
                        sAction,
                        oPayload
                    );
                },

                // =============================================================
                // CANCEL LINE
                // =============================================================

                onCancelLine: function () {

                    var aContexts =
                        this._getSelectedItemContexts();

                    if (!aContexts.length) {

                        MessageToast.show(
                            this.getText(
                                "selectLineToCancel"
                            )
                        );

                        return;
                    }

                    this.getModel("view")
                        .setProperty(
                            "/itemsCancelMode",
                            true
                        );
                },

                onCancelItems: function () {

                    this.onCancelLine();
                },

                // =============================================================
                // CANCEL CONFIRM
                // =============================================================

                onConfirmItemsCancel:
                    function () {

                        var aLines =
                            this._collectLineCancellations();

                        if (!aLines.length) {

                            MessageToast.show(
                                this.getText(
                                    "noLinesToCancel"
                                )
                            );

                            return;
                        }

                        for (
                            var i = 0;
                            i < aLines.length;
                            i++
                        ) {

                            if (aLines[i].error) {

                                MessageBox.error(
                                    this.getText(
                                        "inlineEditLineError",
                                        [
                                            aLines[i].lineId,
                                            aLines[i].error
                                        ]
                                    )
                                );

                                return;
                            }
                        }

                        MessageBox.confirm(
                            this.getText(
                                "inlineCancelConfirmCancel",
                                [
                                    aLines.length
                                ]
                            ) +
                            " " +
                            this.getText(
                                "inlineCancelConfirmWarning"
                            ),
                            {

                                title:
                                    this.getText(
                                        "cancelLine"
                                    ),

                                emphasizedAction:
                                    MessageBox.Action.OK,

                                onClose:
                                    function (
                                        sAction
                                    ) {

                                        if (
                                            sAction ===
                                            MessageBox.Action.OK
                                        ) {

                                            this
                                                ._submitLineCancellations(
                                                    aLines
                                                );
                                        }

                                    }.bind(this)
                            }
                        );
                    },

                _collectLineCancellations:
                    function () {

                        var aLines = [];

                        this
                            ._getSelectedItemContexts()
                            .forEach(
                                function (
                                    oContext
                                ) {

                                    var sLineId =
                                        oContext.getProperty(
                                            "lineId"
                                        );

                                    var sStatus =
                                        oContext.getProperty(
                                            "lineStatus_code"
                                        );

                                    if (
                                        !formatter.isCancellableStatus(
                                            sStatus
                                        )
                                    ) {
                                        return;
                                    }

                                    var sReason =
                                        oContext.getProperty(
                                            "reasonForCancellation_code"
                                        );

                                    aLines.push({

                                        lineId:
                                            sLineId,

                                        payload: {

                                            salesOrder:
                                                this._sHpSalesOrder,

                                            lineID:
                                                sLineId,

                                            reasonForCancellation:
                                                sReason || ""
                                        },

                                        error:
                                            sReason
                                                ? ""
                                                : this.getText(
                                                    "cancellationReasonRequired"
                                                )
                                    });

                                }.bind(this)
                            );

                        return aLines;
                    },

                _submitLineCancellations:
                    function (aLines) {

                        var oViewModel =
                            this.getModel("view");

                        var aErrors = [];

                        var iCancelled = 0;

                        oViewModel.setProperty(
                            "/actionBusy",
                            true
                        );

                        var pRequest =
                            aLines.reduce(
                                function (
                                    pPrevious,
                                    oLine
                                ) {

                                    return pPrevious.then(
                                        function () {

                                            return this
                                                .cancelSalesOrderLine(
                                                    this._sHpSalesOrder,
                                                    oLine.lineId,
                                                    oLine.payload.reasonForCancellation
                                                )
                                                .then(
                                                    function () {
                                                        iCancelled++;
                                                    }
                                                )
                                                .catch(
                                                    function (
                                                        oError
                                                    ) {

                                                        aErrors.push(
                                                            "Line " +
                                                            oLine.lineId +
                                                            ": " +
                                                            (
                                                                oError &&
                                                                    oError.message
                                                                    ? oError.message
                                                                    : String(
                                                                        oError
                                                                    )
                                                            )
                                                        );
                                                    }
                                                );

                                        }.bind(this)
                                    );

                                }.bind(this),
                                Promise.resolve()
                            );

                        return pRequest
                            .then(
                                function () {

                                    if (iCancelled > 0) {

                                        this._refreshDocument();

                                        this._leaveEditMode();

                                        MessageToast.show(
                                            this.getText(
                                                "inlineCancelDone",
                                                [iCancelled]
                                            )
                                        );
                                    }

                                    if (aErrors.length) {

                                        MessageBox.error(
                                            aErrors.join("\n")
                                        );
                                    }

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

                // =============================================================
                // HISTORY
                // =============================================================

                onItemHistory: function () {

                    var aContexts =
                        this._getSelectedItemContexts();

                    if (aContexts.length !== 1) {

                        MessageToast.show(
                            this.getText(
                                "selectOneLineForHistory"
                            )
                        );

                        return;
                    }

                    var sLineId =
                        aContexts[0].getProperty(
                            "lineId"
                        );

                    if (
                        typeof this.navToHistory ===
                        "function"
                    ) {

                        this.navToHistory(
                            this._sHpSalesOrder,
                            sLineId
                        );

                        return;
                    }

                    MessageToast.show(
                        "History navigation is not configured."
                    );
                },

                onViewHistoryForSelection:
                    function () {

                        this.onItemHistory();
                    },

                onViewHistory: function (oEvent) {

                    var oContext =
                        oEvent.getSource()
                            .getBindingContext();

                    if (!oContext) {
                        return;
                    }

                    if (
                        typeof this.navToHistory ===
                        "function"
                    ) {

                        this.navToHistory(
                            this._sHpSalesOrder,
                            oContext.getProperty(
                                "lineId"
                            )
                        );
                    }
                },

                // =============================================================
                // TABLE COUNTER
                // =============================================================

                onItemsUpdateFinished:
                    function () {

                        var oTable =
                            this.byId(
                                "soItemTable"
                            );

                        if (!oTable) {
                            return;
                        }

                        var oBinding =
                            oTable.getBinding("rows");

                        var iCount =
                            oBinding
                                ? (
                                    oBinding.getLength() ||
                                    0
                                )
                                : 0;

                        this._setCountValue(
                            iCount,
                            "/itemCount",
                            "/itemTitle",
                            "items"
                        );

                        if (
                            !this
                                .getModel("view")
                                .getProperty(
                                    "/itemsEditMode"
                                )
                        ) {

                            this._syncSelectedLines();
                        }
                    },

                onChangesUpdateFinished:
                    function (oEvent) {

                        this._setCount(
                            oEvent,
                            "/changeCount",
                            "/changeTitle",
                            "changeHistory"
                        );
                    },

                _setCount: function (
                    oEvent,
                    sCountProperty,
                    sTitleProperty,
                    sTitleKey
                ) {

                    this._setCountValue(
                        oEvent.getParameter(
                            "total"
                        ) || 0,

                        sCountProperty,

                        sTitleProperty,

                        sTitleKey
                    );
                },

                _setCountValue: function (
                    iCount,
                    sCountProperty,
                    sTitleProperty,
                    sTitleKey
                ) {

                    var oViewModel =
                        this.getModel("view");

                    oViewModel.setProperty(
                        sCountProperty,
                        String(iCount)
                    );

                    if (
                        sTitleProperty &&
                        sTitleKey
                    ) {

                        oViewModel.setProperty(
                            sTitleProperty,
                            this.getText(
                                "titleWithCount",
                                [
                                    this.getText(
                                        sTitleKey
                                    ),
                                    iCount
                                ]
                            )
                        );
                    }
                },

                // =============================================================
                // ATTACHMENTS
                // =============================================================

                onOpenAttachments: function () {

                    var oViewModel =
                        this.getModel("view");

                    oViewModel.setProperty(
                        "/selectedTab",
                        "attachments"
                    );

                    var oTabBar =
                        this.byId("soIconTabBar");

                    if (oTabBar) {

                        oTabBar.setSelectedKey(
                            "attachments"
                        );
                    }
                },

                onViewAttachment: function (
                    oEvent
                ) {

                    var oContext =
                        oEvent.getSource()
                            .getBindingContext();

                    if (!oContext) {
                        return;
                    }

                    var sUrl =
                        oContext.getProperty("url");

                    if (sUrl) {

                        window.open(
                            sUrl,
                            "_blank",
                            "noopener,noreferrer"
                        );

                        return;
                    }

                    MessageToast.show(
                        this.getText(
                            "attachmentNotAvailable",
                            [
                                oContext.getProperty(
                                    "fileName"
                                )
                            ]
                        )
                    );
                },

                // =============================================================
                // CHANGE HISTORY SEARCH
                // =============================================================

                onChangeSearch: function (oEvent) {

                    this._sChangeQuery =
                        (
                            oEvent.getParameter(
                                "query"
                            ) || ""
                        ).trim();

                    this._applyChangeFilters();
                },

                onChangeScopeFilter:
                    function (oEvent) {

                        var oItem =
                            oEvent.getParameter(
                                "selectedItem"
                            );

                        this._sChangeScope =
                            oItem
                                ? oItem.getKey()
                                : "ALL";

                        this._applyChangeFilters();
                    },

                _applyChangeFilters: function () {

                    var oTable = this.byId("soChangeTable");

                    if (!oTable) {
                        return;
                    }

                    var oBinding = oTable.getBinding("items");

                    if (!oBinding) {
                        return;
                    }

                    var aFilters = [];

                    // ---------------------------------------------------------
                    // Exclude the composition/root "items" change node
                    // ---------------------------------------------------------

                    aFilters.push(
                        new Filter(
                            "attribute",
                            FilterOperator.NE,
                            "items"
                        )
                    );

                    // ---------------------------------------------------------
                    // Search
                    // ---------------------------------------------------------

                    var sQuery = this._sChangeQuery || "";

                    if (sQuery) {

                        aFilters.push(
                            new Filter({
                                filters: [

                                    new Filter(
                                        "objectID",
                                        FilterOperator.Contains,
                                        sQuery
                                    ),

                                    new Filter(
                                        "attributeLabel",
                                        FilterOperator.Contains,
                                        sQuery
                                    ),

                                    new Filter(
                                        "valueChangedFromLabel",
                                        FilterOperator.Contains,
                                        sQuery
                                    ),

                                    new Filter(
                                        "valueChangedToLabel",
                                        FilterOperator.Contains,
                                        sQuery
                                    ),

                                    new Filter(
                                        "createdBy",
                                        FilterOperator.Contains,
                                        sQuery
                                    ),

                                    new Filter(
                                        "modificationLabel",
                                        FilterOperator.Contains,
                                        sQuery
                                    )

                                ],
                                and: false
                            })
                        );
                    }

                    // ---------------------------------------------------------
                    // Header / Item
                    // ---------------------------------------------------------

                    if (this._sChangeScope === "HEADER") {

                        aFilters.push(
                            new Filter(
                                "entity",
                                FilterOperator.Contains,
                                "SalesOrder"
                            )
                        );

                    } else if (this._sChangeScope === "ITEM") {

                        aFilters.push(
                            new Filter(
                                "entity",
                                FilterOperator.Contains,
                                "SalesOrderItem"
                            )
                        );
                    }

                    // ---------------------------------------------------------
                    // Apply
                    // ---------------------------------------------------------

                    oBinding.filter(
                        new Filter({
                            filters: aFilters,
                            and: true
                        })
                    );
                },
                // =============================================================
                // HEADER HP NOTES
                // =============================================================

                onEditHpNotes: function () {

                    var oTextArea =
                        this.byId(
                            "soHpNotesText"
                        );

                    var oButton =
                        this.byId(
                            "hpNotesEditButton"
                        );

                    if (
                        !oTextArea ||
                        !oButton
                    ) {
                        return;
                    }

                    if (
                        !oTextArea.getEditable()
                    ) {

                        oTextArea.setEditable(
                            true
                        );

                        oButton.setIcon(
                            "sap-icon://save"
                        );

                        oButton.setTooltip(
                            "Save"
                        );

                        oTextArea.focus();

                        return;
                    }

                    this.onSaveHpNotes();
                },

                onSaveHpNotes: function () {

                    var oTextArea =
                        this.byId(
                            "soHpNotesText"
                        );

                    var oButton =
                        this.byId(
                            "hpNotesEditButton"
                        );

                    if (
                        !oTextArea ||
                        !oButton
                    ) {
                        return;
                    }

                    var sNotes =
                        oTextArea.getValue() || "";

                    var oContext =
                        this.getView()
                            .getBindingContext();

                    if (!oContext) {

                        MessageBox.error(
                            "Sales Order context is not available."
                        );

                        return;
                    }

                    var sOriginal =
                        oContext.getProperty(
                            "hpNotesToCustomer"
                        ) || "";

                    if (sNotes === sOriginal) {

                        this._setHpNotesReadOnly();

                        return;
                    }

                    var oViewModel =
                        this.getModel("view");

                    oViewModel.setProperty(
                        "/actionBusy",
                        true
                    );

                    this.callHeaderAction(
                        "updateSalesOrderHeader",
                        {
                            hpSalesOrder:
                                this._sHpSalesOrder,

                            hpNotesToCustomer:
                                sNotes
                        }
                    )
                        .then(
                            function () {

                                this._setHpNotesReadOnly();

                                this._refreshDocument();

                                MessageToast.show(
                                    "HP Notes To Customer saved"
                                );

                            }.bind(this)
                        )
                        .catch(
                            function (oError) {

                                MessageBox.error(
                                    oError &&
                                        oError.message
                                        ? oError.message
                                        : "Failed to save HP Notes To Customer."
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

                _setHpNotesReadOnly:
                    function () {

                        var oTextArea =
                            this.byId(
                                "soHpNotesText"
                            );

                        var oButton =
                            this.byId(
                                "hpNotesEditButton"
                            );

                        if (oTextArea) {

                            oTextArea.setEditable(
                                false
                            );
                        }

                        if (oButton) {

                            oButton.setIcon(
                                "sap-icon://edit"
                            );

                            oButton.setTooltip(
                                "Edit"
                            );
                        }
                    },

                // =============================================================
                // HEADER NOTE
                // =============================================================

                onEditHeaderNote: function () {

                    var oContext =
                        this.getView()
                            .getBindingContext();

                    if (!oContext) {
                        return;
                    }

                    var sValue =
                        oContext.getProperty(
                            "hpNotesToCustomer"
                        ) || "";

                    var oViewModel =
                        this.getModel("view");

                    oViewModel.setProperty(
                        "/headerNoteDraft",
                        sValue
                    );

                    oViewModel.setProperty(
                        "/headerNoteEditMode",
                        true
                    );
                },

                onCancelHeaderNote:
                    function () {

                        this._leaveHeaderNoteEditMode();
                    },

                onSaveHeaderNote:
                    function () {

                        var oViewModel =
                            this.getModel("view");

                        var sDraft =
                            oViewModel.getProperty(
                                "/headerNoteDraft"
                            ) || "";

                        var oContext =
                            this.getView()
                                .getBindingContext();

                        if (!oContext) {

                            MessageBox.error(
                                "Sales Order context is not available."
                            );

                            return;
                        }

                        var sOriginal =
                            oContext.getProperty(
                                "hpNotesToCustomer"
                            ) || "";

                        if (sDraft === sOriginal) {

                            this._leaveHeaderNoteEditMode();

                            return;
                        }

                        oViewModel.setProperty(
                            "/actionBusy",
                            true
                        );

                        this.callHeaderAction(
                            "updateSalesOrderHeader",
                            {
                                hpSalesOrder:
                                    this._sHpSalesOrder,

                                hpNotesToCustomer:
                                    sDraft
                            }
                        )
                            .then(
                                function () {

                                    this._leaveHeaderNoteEditMode();

                                    this._refreshDocument();

                                    MessageToast.show(
                                        "HP Notes To Customer saved"
                                    );

                                }.bind(this)
                            )
                            .catch(
                                function (oError) {

                                    MessageBox.error(
                                        oError &&
                                            oError.message
                                            ? oError.message
                                            : "Failed to save HP Notes To Customer."
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

                _leaveHeaderNoteEditMode:
                    function () {

                        var oViewModel =
                            this.getModel("view");

                        oViewModel.setProperty(
                            "/headerNoteEditMode",
                            false
                        );

                        oViewModel.setProperty(
                            "/headerNoteDraft",
                            ""
                        );
                    },

                // =============================================================
                // NAVIGATION
                // =============================================================

                onItemPress: function (oEvent) {

                    var oContext =
                        oEvent.getSource()
                            .getBindingContext();

                    if (!oContext) {
                        return;
                    }

                    this.navToSalesOrderItem(
                        this._sHpSalesOrder,

                        oContext.getProperty(
                            "lineId"
                        )
                    );
                },

                onNavBackPress: function () {

                    if (
                        !this._hasPendingLineChanges()
                    ) {

                        this._leaveEditMode();

                        this.navBackTo(
                            "salesOrderOverview"
                        );

                        return;
                    }

                    MessageBox.confirm(
                        this.getText(
                            "discardChangesConfirm"
                        ),
                        {

                            title:
                                this.getText(
                                    "discardChangesTitle"
                                ),

                            emphasizedAction:
                                MessageBox.Action.OK,

                            onClose:
                                function (
                                    sAction
                                ) {

                                    if (
                                        sAction !==
                                        MessageBox.Action.OK
                                    ) {
                                        return;
                                    }

                                    this
                                        ._restoreOriginalLineValues();

                                    this._leaveEditMode();

                                    this.navBackTo(
                                        "salesOrderOverview"
                                    );

                                }.bind(this)
                        }
                    );
                },

                // =============================================================
                // FOCUS
                // =============================================================

                _focusFirstInput: function (
                    oRow
                ) {

                    var aCells =
                        oRow.getCells
                            ? oRow.getCells()
                            : [];

                    for (
                        var i = 0;
                        i < aCells.length;
                        i++
                    ) {

                        var oCell =
                            aCells[i];

                        var aCandidates =
                            oCell.getItems
                                ? oCell.getItems()
                                : [oCell];

                        for (
                            var j = 0;
                            j < aCandidates.length;
                            j++
                        ) {

                            var oCandidate =
                                aCandidates[j];

                            if (
                                (
                                    oCandidate.isA(
                                        "sap.m.Input"
                                    ) ||
                                    oCandidate.isA(
                                        "sap.m.Select"
                                    )
                                ) &&
                                oCandidate.getVisible()
                            ) {

                                oCandidate.focus();

                                return;
                            }
                        }
                    }
                }
            }
        );
    }
);