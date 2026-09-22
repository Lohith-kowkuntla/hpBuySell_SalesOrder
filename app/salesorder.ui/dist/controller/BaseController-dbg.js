// -----------------------------------------------------------------------------------*
// Confidential and Proprietary
// Copyright 2026, HP
// All Rights Reserved
// -----------------------------------------------------------------------------------*
// Application Name :    Sales Order
// Module           :    Base Controller
// Namespace        :    hpbuysell.otc.salesorder.ui
// Author           :    HP BuySell Development Team
// Created Date     :    26.08.2026
// Description      :    BaseController.js - Shared controller helpers for the
//                       HP BuySell Sales Order application.
// -----------------------------------------------------------------------------------*
// Change Log:
//    Date      |   Author      |   Defect/Incident     |   Change Description
//    04.09.2026|   Claude      |   -                    |   Added navToHistory,
//                                                            the navigation helper
//                                                            called by
//                                                            SalesOrderDetail and
//                                                            SalesOrderItemDetail
//                                                            to open the audit
//                                                            trail (FDS 3.7.9 /
//                                                            6.7 "Order Change
//                                                            Tracking & View
//                                                            History"). It was
//                                                            referenced but never
//                                                            defined here.
// -----------------------------------------------------------------------------------*

sap.ui.define(
    [
        "sap/ui/core/mvc/Controller",
        "sap/ui/core/UIComponent",
        "sap/ui/core/routing/History",
        "sap/ui/core/Fragment"
    ],
    function (
        Controller,
        UIComponent,
        History,
        Fragment
    ) {
        "use strict";

        // =====================================================================
        // SERVICE URL
        // =====================================================================

        /*
         * OData V2 service endpoint (see manifest.json dataSources.salesOrderService,
         * odataVersion 2.0 - the app runs on the V2 adapter, not native V4).
         *
         * Unbound action/function calls are sent to:
         *
         *   /odata/v2/salesorder/<action>
         *
         * Bound actions (declared inside an entity's `actions { }` block, e.g.
         * cancelLine on SalesOrderItems) are exposed as a FunctionImport named
         * "<EntitySet>_<action>", with the entity KEY passed as URL query
         * literals and the action's OWN parameters passed as a JSON body - see
         * callBoundAction() below.
         */
        var SERVICE_URL = "/odata/v2/salesorder/";

        return Controller.extend(
            "hpbuysell.otc.salesorder.ui.controller.BaseController",
            {

                // =====================================================================
                // Component / Router / Model Helpers
                // =====================================================================

                /**
                 * Convenience access to the owner component.
                 *
                 * @returns {sap.ui.core.UIComponent}
                 */
                getOwnerComponentSafe: function () {

                    return this.getOwnerComponent();
                },

                /**
                 * Returns the router of the owning component.
                 *
                 * @returns {sap.ui.core.routing.Router}
                 */
                getRouter: function () {

                    return UIComponent.getRouterFor(this);
                },

                /**
                 * Returns a model from the current view.
                 *
                 * @param {string} [sName] model name
                 * @returns {sap.ui.model.Model}
                 */
                getModel: function (sName) {

                    return this
                        .getView()
                        .getModel(sName);
                },

                /**
                 * Sets a model on the current view.
                 *
                 * @param {sap.ui.model.Model} oModel model
                 * @param {string} [sName] model name
                 * @returns {this}
                 */
                setModel: function (
                    oModel,
                    sName
                ) {

                    this
                        .getView()
                        .setModel(
                            oModel,
                            sName
                        );

                    return this;
                },

                // =====================================================================
                // i18n Helpers
                // =====================================================================

                /**
                 * Returns the i18n resource bundle.
                 *
                 * @returns {sap.base.i18n.ResourceBundle}
                 */
                getResourceBundle: function () {

                    return this
                        .getOwnerComponent()
                        .getModel("i18n")
                        .getResourceBundle();
                },

                /**
                 * Returns translated text.
                 *
                 * @param {string} sKey i18n key
                 * @param {Array} [aArgs] replacement arguments
                 * @returns {string}
                 */
                getText: function (
                    sKey,
                    aArgs
                ) {

                    return this
                        .getResourceBundle()
                        .getText(
                            sKey,
                            aArgs
                        );
                },

                // =====================================================================
                // Navigation
                // =====================================================================

                /**
                 * Navigates back to the previous application page.
                 *
                 * @param {string} [sFallbackRoute]
                 */
                onNavBack: function (
                    sFallbackRoute
                ) {

                    this.navBackTo(
                        typeof sFallbackRoute === "string"
                            ? sFallbackRoute
                            : "salesOrderOverview"
                    );
                },

                /**
                 * Performs hierarchical back navigation.
                 *
                 * @param {string} sParentRoute
                 * @param {object} [oParameters]
                 */
                navBackTo: function (
                    sParentRoute,
                    oParameters
                ) {

                    var sPreviousHash =
                        History
                            .getInstance()
                            .getPreviousHash();

                    if (
                        sPreviousHash !== undefined
                    ) {

                        window.history.go(-1);

                        return;
                    }

                    this
                        .getRouter()
                        .navTo(
                            sParentRoute,
                            oParameters || {},
                            true
                        );
                },

                /**
                 * Navigate to Sales Order detail.
                 *
                 * @param {string} sSalesOrder
                 */
                navToSalesOrder: function (
                    sSalesOrder
                ) {

                    this
                        .getRouter()
                        .navTo(
                            "salesOrderDetail",
                            {
                                salesOrder:
                                    sSalesOrder
                            }
                        );
                },

                /**
                 * Navigate to Sales Order Item detail.
                 *
                 * @param {string} sSalesOrder
                 * @param {string} sLineId
                 */
                navToSalesOrderItem: function (
                    sSalesOrder,
                    sLineId
                ) {

                    this
                        .getRouter()
                        .navTo(
                            "salesOrderItemDetail",
                            {
                                salesOrder:
                                    sSalesOrder,

                                lineId:
                                    sLineId
                            }
                        );
                },

                /**
                 * Navigate to Sales Order overview.
                 */
                navToSalesOrderOverview: function () {

                    this
                        .getRouter()
                        .navTo(
                            "salesOrderOverview"
                        );
                },

                /**
                 * Navigates to the audit trail (Change/View History screen)
                 * of a Sales Order line, per FDS 3.7.9 / 6.7 "Order Change
                 * Tracking & View History".
                 *
                 * Mirrors the Purchase Order app's navToHistory, using the
                 * same "salesOrder" / "lineId" route parameter names already
                 * used by navToSalesOrderItem above, so it needs a matching
                 * route in manifest.json:
                 *
                 *   {
                 *       "pattern": "SalesOrder/{salesOrder}/item/{lineId}/history",
                 *       "name": "viewHistory",
                 *       "target": "viewHistory"
                 *   }
                 *
                 * Called from:
                 *   - SalesOrderDetail.controller.js
                 *       (onItemHistory / onViewHistoryForSelection / onViewHistory)
                 *   - SalesOrderItemDetail.controller.js
                 *       (onViewHistory)
                 *
                 * @param {string} sSalesOrder HP Sales Order number
                 * @param {string} sLineId Sales Order line id
                 */
                navToHistory: function (
                    sSalesOrder,
                    sLineId
                ) {

                    this
                        .getRouter()
                        .navTo(
                            "viewHistory",
                            {
                                salesOrder:
                                    sSalesOrder,

                                lineId:
                                    sLineId
                            }
                        );
                },

                // =====================================================================
                // OData Key / Binding Path Helpers
                // =====================================================================

                /**
                 * Builds a SalesOrders binding path.
                 *
                 * @param {string} sSalesOrder
                 * @returns {string}
                 */
                buildSalesOrderPath: function (
                    sSalesOrder
                ) {

                    return this.createKeyPath(
                        "SalesOrders",
                        {
                            hpSalesOrder:
                                sSalesOrder
                        }
                    );
                },

                /**
                 * Builds a SalesOrderItems binding path.
                 *
                 * @param {string} sSalesOrder
                 * @param {string} sLineId
                 * @returns {string}
                 */
                buildSalesOrderItemPath: function (
                    sSalesOrder,
                    sLineId
                ) {

                    return this.createKeyPath(
                        "SalesOrderItems",
                        {
                            salesOrder_hpSalesOrder:
                                sSalesOrder,

                            lineId:
                                sLineId
                        }
                    );
                },

                /**
                 * Builds SalesOrderOverview binding path.
                 *
                 * @param {string} sSalesOrder
                 * @param {string} sLineId
                 * @returns {string}
                 */
                buildSalesOrderOverviewPath: function (
                    sSalesOrder,
                    sLineId
                ) {

                    return this.createKeyPath(
                        "SalesOrderSearchExport",
                        {
                            hpSalesOrder:
                                sSalesOrder,

                            lineId:
                                sLineId
                        }
                    );
                },

                /**
                 * Builds an absolute OData key path.
                 *
                 * @param {string} sEntitySet
                 * @param {object} oKeys
                 * @returns {string}
                 */
                createKeyPath: function (
                    sEntitySet,
                    oKeys
                ) {

                    var oModel =
                        this.getModel();

                    if (
                        oModel &&
                        typeof oModel.createKey === "function"
                    ) {

                        return "/" +
                            oModel.createKey(
                                sEntitySet,
                                oKeys
                            );
                    }

                    /*
                     * Fallback when metadata/createKey
                     * is not available.
                     */
                    var aParts =
                        Object
                            .keys(oKeys)
                            .map(
                                function (
                                    sName
                                ) {

                                    return (
                                        sName +
                                        "=" +
                                        this.quote(
                                            oKeys[sName]
                                        )
                                    );

                                }.bind(this)
                            );

                    return (
                        "/" +
                        sEntitySet +
                        "(" +
                        aParts.join(",") +
                        ")"
                    );
                },

                /**
                 * Quotes a string for an OData URL.
                 *
                 * @param {*} vValue
                 * @returns {string}
                 */
                quote: function (
                    vValue
                ) {

                    return (
                        "'" +
                        encodeURIComponent(
                            String(vValue)
                                .replace(
                                    /'/g,
                                    "''"
                                )
                        ) +
                        "'"
                    );
                },

                // =====================================================================
                // Sales Order Dialog Helpers
                // =====================================================================

                /**
                 * Opens a Sales Order action dialog.
                 *
                 * @param {string} sFragmentName
                 * @param {string} sCacheKey
                 * @param {sap.ui.model.json.JSONModel} oModel
                 * @returns {Promise}
                 */
                openSalesOrderDialog: function (
                    sFragmentName,
                    sCacheKey,
                    oModel,
                    sModelName
                ) {

                    var oView =
                        this.getView();

                    this.setModel(
                        oModel,
                        sModelName || "salesOrderAction"
                    );

                    if (!this[sCacheKey]) {

                        this[sCacheKey] =
                            Fragment.load(
                                {
                                    id:
                                        oView.getId(),

                                    name:
                                        "hpbuysell.otc.salesorder.ui.fragment." +
                                        sFragmentName,

                                    controller:
                                        this
                                }
                            ).then(
                                function (
                                    oDialog
                                ) {

                                    oView.addDependent(
                                        oDialog
                                    );

                                    return oDialog;
                                }
                            );
                    }

                    return this[sCacheKey]
                        .then(
                            function (
                                oDialog
                            ) {

                                oDialog.open();

                                return oDialog;
                            }
                        );
                },

                /**
                 * Closes a cached Sales Order dialog.
                 *
                 * @param {string} sCacheKey
                 */
                closeSalesOrderDialog: function (
                    sCacheKey
                ) {

                    if (this[sCacheKey]) {

                        this[sCacheKey]
                            .then(
                                function (
                                    oDialog
                                ) {

                                    oDialog.close();
                                }
                            );
                    }
                },

                // =====================================================================
                // SERVICE / ACTION HELPERS
                // =====================================================================

                /**
                 * Returns the service URL.
                 *
                 * @returns {string}
                 */
                getServiceUrl: function () {

                    return SERVICE_URL;
                },

                /**
                 * Executes a generic Sales Order action.
                 *
                 * Example:
                 *
                 * this.callSalesOrderAction(
                 *     "updateSalesOrderHeader",
                 *     {
                 *         hpSalesOrder: "0005000010",
                 *         hpNotesToCustomer: "Test"
                 *     }
                 * );
                 *
                 * @param {string} sAction
                 * @param {object} oPayload
                 * @returns {Promise<object>}
                 */
                callSalesOrderAction: function (
                    sAction,
                    oPayload
                ) {

                    var sActionName =
                        String(
                            sAction || ""
                        ).replace(
                            /^\/+/,
                            ""
                        );

                    var sUrl =
                        SERVICE_URL +
                        sActionName;

                    return this
                        .postJson(
                            sUrl,
                            oPayload
                        )
                        .then(
                            function (
                                oResponse
                            ) {

                                return oResponse
                                    .text()
                                    .then(
                                        function (
                                            sResponseText
                                        ) {

                                            var oBody =
                                                {};

                                            /*
                                             * CAP normally returns JSON.
                                             * Keep parsing defensive so that
                                             * an empty 204 response doesn't
                                             * cause JSON.parse() to fail.
                                             */
                                            if (
                                                sResponseText
                                            ) {

                                                try {

                                                    oBody =
                                                        JSON.parse(
                                                            sResponseText
                                                        );

                                                } catch (
                                                    oParseError
                                                ) {

                                                    oBody = {
                                                        raw:
                                                            sResponseText
                                                    };
                                                }
                                            }

                                            if (
                                                !oResponse.ok
                                            ) {

                                                throw this._createHttpError(
                                                    oResponse,
                                                    oBody
                                                );
                                            }

                                            return this._unwrapODataV2Body(
                                                oBody,
                                                sActionName
                                            );

                                        }.bind(this)
                                    );
                            }.bind(this)
                        );
                },

                /**
                 * Unwraps an OData V2 FunctionImport response body.
                 *
                 * A V2 response for a FunctionImport returning a complex type
                 * is wrapped two levels deep:
                 *
                 *   { d: { <FunctionImportName>: { ...actual result... } } }
                 *
                 * (confirmed against the running @cap-js-community/odata-v2-adapter
                 * for both bound actions and unbound functions/actions).
                 *
                 * @param {object} oBody
                 * @param {string} sFunctionImportName
                 * @returns {object}
                 */
                _unwrapODataV2Body: function (
                    oBody,
                    sFunctionImportName
                ) {

                    var oD =
                        (oBody && oBody.d) ||
                        oBody ||
                        {};

                    if (
                        sFunctionImportName &&
                        oD[sFunctionImportName] &&
                        typeof oD[sFunctionImportName] === "object"
                    ) {

                        return oD[sFunctionImportName];
                    }

                    return oD;
                },

                /**
                 * Executes a Sales Order header action.
                 *
                 * Used by SalesOrderDetail.controller.js:
                 *
                 *     this.callHeaderAction(
                 *         "updateSalesOrderHeader",
                 *         payload
                 *     );
                 *
                 * @param {string} sAction
                 * @param {object} oPayload
                 * @returns {Promise<object>}
                 */
                callHeaderAction: function (
                    sAction,
                    oPayload
                ) {

                    return this.callSalesOrderAction(
                        sAction,
                        oPayload
                    );
                },

                /**
                 * Executes a Sales Order line-item action.
                 *
                 * Used by SalesOrderDetail.controller.js:
                 *
                 *     this.callLineAction(
                 *         "updateSalesOrderItem",
                 *         payload
                 *     );
                 *
                 * @param {string} sAction
                 * @param {object} oPayload
                 * @returns {Promise<object>}
                 */
                callLineAction: function (
                    sAction,
                    oPayload
                ) {

                    return this.callSalesOrderAction(
                        sAction,
                        oPayload
                    );
                },

                /**
                 * Calls a bound OData action (declared inside an entity's
                 * `actions { }` block in CDS). Under OData V2 this is exposed
                 * as a FunctionImport named "<EntitySet>_<action>": the
                 * entity's key is passed as URL query literals, and the
                 * action's own parameters are passed as a JSON body.
                 *
                 * @param {string} sEntitySet
                 * @param {object} oKeys
                 * @param {string} sAction
                 * @param {object} oParams
                 * @returns {Promise<object>}
                 */
                callBoundAction: function (
                    sEntitySet,
                    oKeys,
                    sAction,
                    oParams
                ) {

                    var sFunctionImportName =
                        sEntitySet + "_" + sAction;

                    var sUrl =
                        SERVICE_URL +
                        sFunctionImportName;

                    var aQuery =
                        Object.keys(oKeys || {})
                            .filter(function (sKey) {
                                return oKeys[sKey] !== undefined && oKeys[sKey] !== null;
                            })
                            .map(function (sKey) {
                                return sKey + "=" + this.quote(oKeys[sKey]);
                            }.bind(this));

                    if (aQuery.length) {

                        sUrl += "?" + aQuery.join("&");
                    }

                    return this
                        .postJson(
                            sUrl,
                            oParams
                        )
                        .then(
                            function (
                                oResponse
                            ) {

                                return oResponse
                                    .text()
                                    .then(
                                        function (
                                            sResponseText
                                        ) {

                                            var oBody =
                                                {};

                                            if (
                                                sResponseText
                                            ) {

                                                try {

                                                    oBody =
                                                        JSON.parse(
                                                            sResponseText
                                                        );

                                                } catch (
                                                    oParseError
                                                ) {

                                                    oBody = {
                                                        raw:
                                                            sResponseText
                                                    };
                                                }
                                            }

                                            if (
                                                !oResponse.ok
                                            ) {

                                                throw this._createHttpError(
                                                    oResponse,
                                                    oBody
                                                );
                                            }

                                            return this._unwrapODataV2Body(
                                                oBody,
                                                sFunctionImportName
                                            );

                                        }.bind(this)
                                    );
                            }.bind(this)
                        );
                },

                /**
                 * Cancels a Sales Order line item - the single call site used
                 * by every Cancel Line entry point in the app.
                 *
                 * @param {string} sHpSalesOrder
                 * @param {string} sLineId
                 * @param {string} sReasonCode
                 * @returns {Promise<object>} resolves to an UpdateResult
                 */
                cancelSalesOrderLine: function (
                    sHpSalesOrder,
                    sLineId,
                    sReasonCode
                ) {

                    return this.callBoundAction(
                        "SalesOrderItems",
                        {
                            salesOrder_hpSalesOrder:
                                sHpSalesOrder,

                            lineId:
                                sLineId
                        },
                        "cancelLine",
                        {
                            reasonForCancellation:
                                sReasonCode
                        }
                    );
                },

                /**
                 * Creates a useful Error object from
                 * an HTTP/CAP response.
                 *
                 * @param {Response} oResponse
                 * @param {object} oBody
                 * @returns {Error}
                 */
                _createHttpError: function (
                    oResponse,
                    oBody
                ) {

                    var sMessage = "";

                    /*
                     * CAP OData error:
                     *
                     * {
                     *   "error": {
                     *      "code": "...",
                     *      "message": "..."
                     *   }
                     * }
                     */
                    if (
                        oBody &&
                        oBody.error
                    ) {

                        if (
                            typeof oBody.error.message ===
                            "string"
                        ) {

                            sMessage =
                                oBody.error.message;

                        } else if (
                            oBody.error.message &&
                            typeof oBody.error.message.value ===
                            "string"
                        ) {

                            sMessage =
                                oBody.error.message.value;
                        }

                    } else if (
                        oBody &&
                        typeof oBody.message ===
                        "string"
                    ) {

                        sMessage =
                            oBody.message;

                    } else if (
                        oBody &&
                        typeof oBody.raw ===
                        "string"
                    ) {

                        sMessage =
                            oBody.raw;
                    }

                    if (!sMessage) {

                        sMessage =
                            "HTTP " +
                            oResponse.status +
                            " " +
                            (
                                oResponse.statusText ||
                                ""
                            );
                    }

                    var oError =
                        new Error(
                            sMessage
                        );

                    oError.status =
                        oResponse.status;

                    oError.statusText =
                        oResponse.statusText;

                    oError.response =
                        oResponse;

                    oError.body =
                        oBody;

                    return oError;
                },

                /**
                 * POSTs JSON to the CAP service.
                 *
                 * @param {string} sUrl
                 * @param {object} oPayload
                 * @returns {Promise<Response>}
                 */
                postJson: function (
                    sUrl,
                    oPayload
                ) {

                    return this
                        .fetchCsrfToken()
                        .then(
                            function (
                                sToken
                            ) {

                                var oHeaders = {

                                    "Content-Type":
                                        "application/json",

                                    "Accept":
                                        "application/json"

                                };

                                if (sToken) {

                                    oHeaders[
                                        "X-CSRF-Token"
                                    ] = sToken;
                                }

                                return fetch(
                                    sUrl,
                                    {
                                        method:
                                            "POST",

                                        headers:
                                            oHeaders,

                                        credentials:
                                            "same-origin",

                                        body:
                                            JSON.stringify(
                                                oPayload ||
                                                {}
                                            )
                                    }
                                );
                            }
                        );
                },

                /**
                 * Fetches an X-CSRF token.
                 *
                 * @returns {Promise<string>}
                 */
                fetchCsrfToken: function () {

                    return fetch(
                        SERVICE_URL,
                        {
                            method:
                                "HEAD",

                            headers: {
                                "X-CSRF-Token":
                                    "Fetch"
                            },

                            credentials:
                                "same-origin"
                        }
                    )
                        .then(
                            function (
                                oResponse
                            ) {

                                return (
                                    oResponse
                                        .headers
                                        .get(
                                            "X-CSRF-Token"
                                        ) ||
                                    ""
                                );
                            }
                        )
                        .catch(
                            function () {

                                return "";
                            }
                        );
                },

                // =====================================================================
                // DATE HELPERS
                // =====================================================================

                /**
                 * Converts a Date value to yyyy-MM-dd.
                 *
                 * @param {Date|string} vDate
                 * @returns {string|null}
                 */
                toDateString: function (
                    vDate
                ) {

                    if (!vDate) {

                        return null;
                    }

                    var oDate =
                        vDate instanceof Date
                            ? vDate
                            : new Date(vDate);

                    if (
                        isNaN(
                            oDate.getTime()
                        )
                    ) {

                        return null;
                    }

                    var bUtcMidnight =
                        oDate.getUTCHours() === 0 &&
                        oDate.getUTCMinutes() === 0 &&
                        oDate.getUTCSeconds() === 0 &&
                        oDate.getUTCMilliseconds() === 0;

                    var iYear =
                        bUtcMidnight
                            ? oDate.getUTCFullYear()
                            : oDate.getFullYear();

                    var iMonth =
                        (
                            bUtcMidnight
                                ? oDate.getUTCMonth()
                                : oDate.getMonth()
                        ) + 1;

                    var iDay =
                        bUtcMidnight
                            ? oDate.getUTCDate()
                            : oDate.getDate();

                    return (
                        iYear +
                        "-" +
                        String(iMonth)
                            .padStart(2, "0") +
                        "-" +
                        String(iDay)
                            .padStart(2, "0")
                    );
                },

                // =====================================================================
                // SALES ORDER VALIDATION
                // =====================================================================

                /**
                 * Validates Sales Order line changes.
                 *
                 * @param {object} oLine
                 * @returns {string|null}
                 */
                validateSalesOrderLineChange: function (
                    oLine
                ) {

                    var fQuantity =
                        parseFloat(
                            oLine.quantity
                        );

                    var fSalesPrice =
                        parseFloat(
                            oLine.salesPrice
                        );

                    if (!(fQuantity > 0)) {

                        return this.getText(
                            "quantityMustBePositive"
                        );
                    }

                    if (
                        oLine.salesPrice !== undefined &&
                        !(fSalesPrice >= 0)
                    ) {

                        return this.getText(
                            "salesPriceInvalid"
                        );
                    }

                    if (
                        oLine.plannedReceiptDate
                    ) {

                        var oDate =
                            oLine.plannedReceiptDate
                                instanceof Date
                                ? oLine.plannedReceiptDate
                                : new Date(
                                    oLine.plannedReceiptDate
                                );

                        var oToday =
                            new Date();

                        oToday.setHours(
                            0,
                            0,
                            0,
                            0
                        );

                        if (
                            isNaN(
                                oDate.getTime()
                            )
                        ) {

                            return this.getText(
                                "plannedReceiptDateInvalid"
                            );
                        }

                        if (
                            oDate < oToday
                        ) {

                            return this.getText(
                                "plannedReceiptDateInPast"
                            );
                        }
                    }

                    return null;
                },

                /**
                 * Determines whether Sales Order price changed.
                 *
                 * @param {*} vOriginal
                 * @param {*} vCurrent
                 * @returns {boolean}
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
                        isNaN(fOriginal) ||
                        isNaN(fCurrent)
                    ) {

                        return (
                            fOriginal !==
                            fCurrent
                        );
                    }

                    return (
                        Math.round(
                            fOriginal * 100
                        ) !==
                        Math.round(
                            fCurrent * 100
                        )
                    );
                }

            }
        );
    }
);