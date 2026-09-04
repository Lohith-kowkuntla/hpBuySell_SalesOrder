sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/Device",
    "sap/ui/model/json/JSONModel",
    "./model/models"
], function (UIComponent, Device, JSONModel, models) {
    "use strict";

    return UIComponent.extend("hpbuysell.otc.salesorder.ui.Component", {
        metadata: {
            manifest: "json"
        },

        init: function () {
            UIComponent.prototype.init.apply(this, arguments);

            this.setModel(models.createDeviceModel(), "device");

            // Deny-by-default until getUserInfo() resolves the real role.
            var oUserModel = new JSONModel({
                isHpBuyer: false,
                isViewer: false,
                loaded: false
            });
            this.setModel(oUserModel, "user");
            this._loadUserInfo(oUserModel);

            this.getRouter().initialize();
        },

        /**
         * Fetches the current user's role (HP Buyer vs Viewer/Customer) once
         * at component start-up and caches it on the shared "user" model, so
         * every view/controller can bind to user>/isHpBuyer with no extra
         * plumbing.
         *
         * @param {sap.ui.model.json.JSONModel} oUserModel
         */
        _loadUserInfo: function (oUserModel) {

            var sServiceUrl = this.getManifestEntry("/sap.app/dataSources/salesOrderService/uri");

            fetch(sServiceUrl + "getUserInfo", {
                method: "GET",
                credentials: "same-origin",
                headers: { Accept: "application/json" }
            })
                .then(function (oResponse) {
                    return oResponse.ok ? oResponse.json() : {};
                })
                .then(function (oBody) {
                    var oResult = (oBody && oBody.d && oBody.d.getUserInfo) || (oBody && oBody.d) || oBody || {};
                    oUserModel.setData({
                        isHpBuyer: !!oResult.isHpBuyer,
                        isViewer: !!oResult.isViewer,
                        loaded: true
                    });
                })
                .catch(function () {
                    // keep the safe, deny-by-default state
                });
        }
    });
});
