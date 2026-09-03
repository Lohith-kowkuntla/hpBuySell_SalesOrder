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

            // Replace this temporary flag with your XSUAA/role resolution.
            this.setModel(new JSONModel({
                isHPBuyer: true,
                isHPViewer: false,
                isCustomerViewer: false
            }), "user");

            this.getRouter().initialize();
        }
    });
});
