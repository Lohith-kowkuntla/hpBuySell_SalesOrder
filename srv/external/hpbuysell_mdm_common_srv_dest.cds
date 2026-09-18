/* checksum : bdee641e975ffd763d1142e7aa739d92 */
@cds.external : true
service hpbuysell_mdm_common_srv_dest {
  @cds.external : true
  @cds.persistence.skip : true
  @UI.SelectionFields : [ 'supplierid', 'suppliername' ]
  @UI.LineItem : [
    {
      $Type: 'UI.DataField',
      Value: supplierid,
      Label: 'common.label.supplierId'
    }
  ]
  @Capabilities.DeleteRestrictions.Deletable : false
  @Capabilities.InsertRestrictions.Insertable : false
  @Capabilities.UpdateRestrictions.Updatable : false
  entity SupplierVH {
    @Common.Label : 'common.label.supplierId'
    key supplierid : String(10) not null;
    @Common.Label : 'common.label.supplierName'
    suppliername : String(40);
  };

  @cds.external : true
  @cds.persistence.skip : true
  @UI.SelectionFields : [ 'customerid', 'customername' ]
  @UI.LineItem : [
    {
      $Type: 'UI.DataField',
      Value: customerid,
      Label: 'common.label.customerId'
    },
    {
      $Type: 'UI.DataField',
      Value: customername,
      Label: 'common.label.customerName'
    }
  ]
  @Capabilities.DeleteRestrictions.Deletable : false
  @Capabilities.InsertRestrictions.Insertable : false
  @Capabilities.UpdateRestrictions.Updatable : false
  entity CustomerVH {
    @Common.Label : 'common.label.customerId'
    key customerid : String(10) not null;
    @Common.Label : 'common.label.customerName'
    customername : String(40);
  };

  @cds.external : true
  @cds.persistence.skip : true
  @UI.SelectionFields : [ 'wbselement', 'wbsdescription' ]
  @UI.LineItem : [
    {
      $Type: 'UI.DataField',
      Value: wbselement,
      Label: 'common.label.wbsElement'
    },
    {
      $Type: 'UI.DataField',
      Value: wbsdescription,
      Label: 'common.label.wbsDescription'
    }
  ]
  @Capabilities.DeleteRestrictions.Deletable : false
  @Capabilities.InsertRestrictions.Insertable : false
  @Capabilities.UpdateRestrictions.Updatable : false
  entity ProjectVH {
    @Common.Label : 'common.label.wbsElement'
    key wbselement : String(10) not null;
    @Common.Label : 'common.label.wbsDescription'
    wbsdescription : String(40);
  };

  @cds.external : true
  @cds.persistence.skip : true
  @UI.SelectionFields : [ 'companycode', 'companyname' ]
  @UI.LineItem : [
    {
      $Type: 'UI.DataField',
      Value: companycode,
      Label: 'common.label.companyCode'
    },
    {
      $Type: 'UI.DataField',
      Value: companyname,
      Label: 'common.label.companyName'
    }
  ]
  @Capabilities.DeleteRestrictions.Deletable : false
  @Capabilities.InsertRestrictions.Insertable : false
  @Capabilities.UpdateRestrictions.Updatable : false
  entity CompanyCodeVH {
    @Common.Label : 'common.label.companyCode'
    key companycode : String(4) not null;
    @Common.Label : 'common.label.companyName'
    companyname : String(40);
  };

  @cds.external : true
  @cds.persistence.skip : true
  @UI.SelectionFields : [ 'materialnumber', 'materialdescription' ]
  @UI.LineItem : [
    {
      $Type: 'UI.DataField',
      Value: materialnumber,
      Label: 'common.label.materialNumber'
    },
    {
      $Type: 'UI.DataField',
      Value: materialdescription,
      Label: 'common.label.materialDescription'
    }
  ]
  @Capabilities.DeleteRestrictions.Deletable : false
  @Capabilities.InsertRestrictions.Insertable : false
  @Capabilities.UpdateRestrictions.Updatable : false
  entity MaterialVH {
    @Common.Label : 'common.label.materialNumber'
    key materialnumber : String(18) not null;
    @Common.Label : 'common.label.materialDescription'
    materialdescription : String(40);
  };

  @cds.external : true
  @cds.persistence.skip : true
  @UI.SelectionFields : [ 'plant', 'plantname' ]
  @UI.LineItem : [
    { $Type: 'UI.DataField', Value: plant, Label: 'common.label.plant' },
    {
      $Type: 'UI.DataField',
      Value: plantname,
      Label: 'common.label.plantName'
    }
  ]
  @Capabilities.DeleteRestrictions.Deletable : false
  @Capabilities.InsertRestrictions.Insertable : false
  @Capabilities.UpdateRestrictions.Updatable : false
  entity PlantVH {
    @Common.Label : 'common.label.plant'
    key plant : String(10) not null;
    @Common.Label : 'common.label.plantName'
    plantname : String(10);
  };

  @cds.external : true
  @cds.persistence.skip : true
  @UI.SelectionFields : [ 'storagelocation', 'plant', 'storagelocationname' ]
  @UI.LineItem : [
    {
      $Type: 'UI.DataField',
      Value: storagelocation,
      Label: 'common.label.storageLocation'
    },
    { $Type: 'UI.DataField', Value: plant, Label: 'common.label.plant' },
    {
      $Type: 'UI.DataField',
      Value: storagelocationname,
      Label: 'common.label.storageLocationName'
    }
  ]
  @Capabilities.DeleteRestrictions.Deletable : false
  @Capabilities.InsertRestrictions.Insertable : false
  @Capabilities.UpdateRestrictions.Updatable : false
  entity StorageLocationVH {
    @Common.Label : 'common.label.storageLocation'
    key storagelocation : String(4) not null;
    @Common.Label : 'common.label.plant'
    key plant : String(10) not null;
    @Common.Label : 'common.label.storageLocationName'
    storagelocationname : String(4);
  };

  @cds.external : true
  @cds.persistence.skip : true
  @UI.SelectionFields : [ 'businessmodel', 'businessmodeldescription' ]
  @UI.LineItem : [
    {
      $Type: 'UI.DataField',
      Value: businessmodel,
      Label: 'common.label.businessModel'
    },
    {
      $Type: 'UI.DataField',
      Value: businessmodeldescription,
      Label: 'common.label.businessModelDescription'
    }
  ]
  @Capabilities.DeleteRestrictions.Deletable : false
  @Capabilities.InsertRestrictions.Insertable : false
  @Capabilities.UpdateRestrictions.Updatable : false
  entity BusinessModelVH {
    @Common.Label : 'common.label.businessModel'
    key businessmodel : String(10) not null;
    @Common.Label : 'common.label.businessModelDescription'
    businessmodeldescription : String(10);
  };

  @cds.external : true
  @cds.persistence.skip : true
  @UI.SelectionFields : [ 'buyercode', 'buyername' ]
  @UI.LineItem : [
    {
      $Type: 'UI.DataField',
      Value: buyercode,
      Label: 'common.label.buyerCode'
    },
    {
      $Type: 'UI.DataField',
      Value: buyername,
      Label: 'common.label.buyerName'
    }
  ]
  @Capabilities.DeleteRestrictions.Deletable : false
  @Capabilities.InsertRestrictions.Insertable : false
  @Capabilities.UpdateRestrictions.Updatable : false
  entity BuyerVH {
    @Common.Label : 'common.label.buyerCode'
    key buyercode : String(3) not null;
    @Common.Label : 'common.label.buyerName'
    buyername : String(3);
  };

  @cds.external : true
  @cds.persistence.skip : true
  @UI.SelectionFields : [ 'rmacode', 'rmaname' ]
  @UI.LineItem : [
    { $Type: 'UI.DataField', Value: rmacode, Label: 'common.label.rmaCode' },
    { $Type: 'UI.DataField', Value: rmaname, Label: 'common.label.rmaName' }
  ]
  @Capabilities.DeleteRestrictions.Deletable : false
  @Capabilities.InsertRestrictions.Insertable : false
  @Capabilities.UpdateRestrictions.Updatable : false
  entity RmaCoordinatorVH {
    @Common.Label : 'common.label.rmaCode'
    key rmacode : String(10) not null;
    @Common.Label : 'common.label.rmaName'
    rmaname : String(10);
  };

  @cds.external : true
  @cds.persistence.skip : true
  @UI.SelectionFields : [ 'ibstatus', 'ibstatusdescription' ]
  @UI.LineItem : [
    {
      $Type: 'UI.DataField',
      Value: ibstatus,
      Label: 'common.label.ibStatus'
    },
    {
      $Type: 'UI.DataField',
      Value: ibstatusdescription,
      Label: 'common.label.ibStatusDescription'
    }
  ]
  @Capabilities.DeleteRestrictions.Deletable : false
  @Capabilities.InsertRestrictions.Insertable : false
  @Capabilities.UpdateRestrictions.Updatable : false
  entity IBStatusVH {
    @Common.Label : 'common.label.ibStatus'
    key ibstatus : String(1) not null;
    @Common.Label : 'common.label.ibStatusDescription'
    ibstatusdescription : String(1);
  };

  @cds.external : true
  @cds.persistence.skip : true
  @UI.SelectionFields : [ 'obstatus', 'obstatusdescription' ]
  @UI.LineItem : [
    {
      $Type: 'UI.DataField',
      Value: obstatus,
      Label: 'common.label.obStatus'
    },
    {
      $Type: 'UI.DataField',
      Value: obstatusdescription,
      Label: 'common.label.obStatusDescription'
    }
  ]
  @Capabilities.DeleteRestrictions.Deletable : false
  @Capabilities.InsertRestrictions.Insertable : false
  @Capabilities.UpdateRestrictions.Updatable : false
  entity OBStatusVH {
    @Common.Label : 'common.label.obStatus'
    key obstatus : String(1) not null;
    @Common.Label : 'common.label.obStatusDescription'
    obstatusdescription : String(1);
  };

  @cds.external : true
  @cds.persistence.skip : true
  @Capabilities.DeleteRestrictions.Deletable : false
  @Capabilities.InsertRestrictions.Insertable : false
  @Capabilities.UpdateRestrictions.Updatable : false
  entity CustomerPartners {
    key partnercode : String(10) not null;
    partnerfunction : String(255);
    partnerfunctiondescription : String(35);
    parentcustomercode : String(10);
    salesorg : String(4);
    parza : String(3);
  };

  @cds.external : true
  @cds.persistence.skip : true
  @Capabilities.DeleteRestrictions.Deletable : false
  @Capabilities.InsertRestrictions.Insertable : false
  @Capabilities.UpdateRestrictions.Updatable : false
  entity SupplierPartners {
    key partnersupplierid : String(10) not null;
    partnerfunction : String(10);
    supplier_supplierid : String(10);
    purchasingorg : String(4);
    parza : String(3);
  };

  @cds.external : true
  @cds.persistence.skip : true
  @Capabilities.DeleteRestrictions.Deletable : false
  @Capabilities.InsertRestrictions.Insertable : false
  @Capabilities.UpdateRestrictions.Updatable : false
  entity Customer {
    key customerid : String(10) not null;
    customername : String(40);
  };

  @cds.external : true
  @cds.persistence.skip : true
  @Capabilities.DeleteRestrictions.Deletable : false
  @Capabilities.InsertRestrictions.Insertable : false
  @Capabilities.UpdateRestrictions.Updatable : false
  entity Supplier {
    key supplierid : String(10) not null;
    suppliername : String(35);
  };

  @cds.external : true
  @cds.persistence.skip : true
  @Capabilities.DeleteRestrictions.Deletable : false
  @Capabilities.InsertRestrictions.Insertable : false
  @Capabilities.UpdateRestrictions.Updatable : false
  entity Project {
    key wbsElement : String(10) not null;
    key salesDocument : String(10) not null;
    key customer : String(10) not null;
    key supplierCode : String(10) not null;
    key hpPartNumber : String(18) not null;
    EDIBTPMigrationStartDate : Date;
    wbsDescription : String(40);
    purchasingDocumentNumber : String(10);
    customerDescription : String(40);
    companyCode : String(4);
    supplierDescription : String(40);
    materialDescription : String(40);
    shipTo : String(10);
    customerPartNumber : String(35);
    supplierPartNumber : String(35);
    purchasingOrganization : String(4);
    salesOrganization : String(4);
    carrierSo : String(10);
    carrierPo : String(10);
    termsOfPayment : String(4);
    toleranceKey : String(1);
    incotermsSoTermsOfDelivery : String(3);
    incotermsSoDeliveryPlace : String(30);
    incotermsPoTermsOfDelivery : String(3);
    incotermsPoDeliveryPlace : String(30);
    billTo : String(10);
    payer : String(10);
    soReqBlock : String(2);
    soPoAutomation : String(2);
    inboundProcessingMethod : String(1);
    contractDocumentItem : String(4);
    businessModel : String(10);
    shippingMethodSales : String(10);
    countryKey : String(3);
    reasonForRejectionOfSalesDocument : String(2);
    minimumOrderQuantity : Decimal(13, 3);
    multipleOrderQuantityMarcBstrf : Decimal(13, 3);
    transitTime : Decimal(5, 0);
    projectPlannedStartDate : Date;
    projectPlannedFinishDate : Date;
    outboundProcessingMethod : String(1);
    poBlanketIndicator : String(4);
    soBlanketIndicator : String(4);
    unitOfWeight : String(3);
    ediPoOutIndicator : Boolean;
    sourceListRecordValidFrom : Date;
    sourceListRecordValidTo : Date;
    preferredSupplier : String(1);
    purchasingGroup : String(3);
    shippingType : String(2);
    currencyKey : String(5);
    termsOfPaymentKey : String(4);
    shipFromCode : String(10);
    legalContractNumber : String(40);
    @odata.Precision : 7
    @odata.Type : 'Edm.DateTimeOffset'
    startOfValidityPeriod : Timestamp;
    htsFromAndEccnAreRequired : String(1);
    priceUnit : Decimal(5, 0);
    materialPoText : String(50);
    incoTermRevisionPurchasing : String(20);
    generalItemText : String(50);
    businessArea : String(4);
    storageLocation : String(4);
    hpRmaCoordinator : String(10);
    plant : String(10);
    accountNumberOfSupplier : String(10);
    packingList : String(1);
    invoiceForCustomsPurposes : String(1);
    hpIsEor : String(1);
    hpIsIor : String(1);
    salesGroup : String(4);
    netValueOfTheSalesDocumentInDocumentCurrency : String(5);
    customerNumber : String(40);
    documentDate : Date;
    soPricingPolicy : String(2);
    unlimitedToleranceForOutboundGi : String(1);
    incoTermRevisionSales : String(3);
    hpSalesOrganization : String(4);
    salesUnit : String(3);
  };

  @cds.external : true
  @cds.persistence.skip : true
  @Capabilities.DeleteRestrictions.Deletable : false
  @Capabilities.InsertRestrictions.Insertable : false
  @Capabilities.UpdateRestrictions.Updatable : false
  entity ProjectUAMVH {
    key wbselement : String(10) not null;
    key customer : String(10) not null;
    key suppliercode : String(10) not null;
    companycode : String(4);
    wbsdescription : String(40);
  };

  @cds.external : true
  @cds.persistence.skip : true
  @Capabilities.DeleteRestrictions.Deletable : false
  @Capabilities.InsertRestrictions.Insertable : false
  @Capabilities.UpdateRestrictions.Updatable : false
  entity ProjectCompanyVH {
    key wbselement : String(10) not null;
    key companycode : String(4) not null;
    wbsdescription : String(40);
  };

  @cds.external : true
  @cds.persistence.skip : true
  @Capabilities.DeleteRestrictions.Deletable : false
  @Capabilities.InsertRestrictions.Insertable : false
  @Capabilities.UpdateRestrictions.Updatable : false
  entity User {
    key email : String(241) not null;
    firstName : String(100);
    lastName : String(100);
    userName : String(100);
    userType : String(50);
    userGroupIndicator : String(50);
  };

  @cds.external : true
  @cds.persistence.skip : true
  @Capabilities.DeleteRestrictions.Deletable : false
  @Capabilities.InsertRestrictions.Insertable : false
  @Capabilities.UpdateRestrictions.Updatable : false
  entity UserGroup {
    key user_email : String(241) not null;
    key groupid : String(255) not null;
    groupname : String(255);
  };

  @cds.external : true
  @cds.persistence.skip : true
  @Capabilities.DeleteRestrictions.Deletable : false
  @Capabilities.InsertRestrictions.Insertable : false
  @Capabilities.UpdateRestrictions.Updatable : false
  entity UserProjects {
    key projectid : String(20) not null;
    key id : String(36) not null;
    partner_id : String(36);
    projectname : String(100);
  };

  @cds.external : true
  @cds.persistence.skip : true
  @Capabilities.DeleteRestrictions.Deletable : false
  @Capabilities.InsertRestrictions.Insertable : false
  @Capabilities.UpdateRestrictions.Updatable : false
  entity UserPartners {
    key partnerid : String(20) not null;
    key id : String(36) not null;
    partnername : String(100);
    partnertype : String(1);
    user_email : String(241);
  };

  @cds.external : true
  @cds.persistence.skip : true
  @Capabilities.DeleteRestrictions.Deletable : false
  @Capabilities.InsertRestrictions.Insertable : false
  @Capabilities.UpdateRestrictions.Updatable : false
  entity Buyer {
    key searchterm1 : String(10) not null;
    buyername : String(512);
    buyername2 : String(512);
    email : String(512);
  };

  @cds.external : true
  @cds.persistence.skip : true
  @Capabilities.DeleteRestrictions.Deletable : false
  @Capabilities.InsertRestrictions.Insertable : false
  @Capabilities.UpdateRestrictions.Updatable : false
  entity CompanyCode {
    key companycode : String(4) not null;
    companycodedescription : String(40);
  };

  @cds.external : true
  @cds.persistence.skip : true
  @Capabilities.DeleteRestrictions.Deletable : false
  @Capabilities.InsertRestrictions.Insertable : false
  @Capabilities.UpdateRestrictions.Updatable : false
  entity Alert {
    key alertId : Integer not null;
    description : String(120);
    category : String(255);
    isActive : Boolean;
    subscriptionTypeCode : String(10);
    isDefault : Boolean;
    flexField1 : String(255);
    flexField2 : String(255);
    flexField3 : String(255);
    flexField4 : String(255);
    flexField5 : String(255);
    @odata.Precision : 7
    @odata.Type : 'Edm.DateTimeOffset'
    createdAt : Timestamp;
    createdBy : String(255);
    @odata.Precision : 7
    @odata.Type : 'Edm.DateTimeOffset'
    modifiedAt : Timestamp;
    modifiedBy : String(255);
  };

  @cds.external : true
  @cds.persistence.skip : true
  @Capabilities.DeleteRestrictions.Deletable : false
  @Capabilities.InsertRestrictions.Insertable : false
  @Capabilities.UpdateRestrictions.Updatable : false
  entity AlertAllowedProfile {
    key alertId : Integer not null;
    key userGroupIndicator : String(2) not null;
  };

  @cds.external : true
  @cds.persistence.skip : true
  @Capabilities.DeleteRestrictions.Deletable : false
  @Capabilities.InsertRestrictions.Insertable : false
  @Capabilities.UpdateRestrictions.Updatable : false
  entity AlertSubscriptionType {
    key code : String(10) not null;
    description : String(100);
    defaultSubscribed : Boolean;
    canUnsubscribe : Boolean;
  };

  @cds.external : true
  @cds.persistence.skip : true
  @Capabilities.DeleteRestrictions.Deletable : false
  @Capabilities.InsertRestrictions.Insertable : false
  @Capabilities.UpdateRestrictions.Updatable : false
  entity Subscription {
    key ID : String(36) not null;
    userId : String(256);
    alert_alertId : Integer;
    active : Boolean;
    flexField1 : String(255);
    flexField2 : String(255);
    flexField3 : String(255);
    flexField4 : String(255);
    flexField5 : String(255);
    @odata.Precision : 7
    @odata.Type : 'Edm.DateTimeOffset'
    createdAt : Timestamp;
    createdBy : String(255);
    @odata.Precision : 7
    @odata.Type : 'Edm.DateTimeOffset'
    modifiedAt : Timestamp;
    modifiedBy : String(255);
  };

  @cds.external : true
  @cds.persistence.skip : true
  @Capabilities.DeleteRestrictions.Deletable : false
  @Capabilities.InsertRestrictions.Insertable : false
  @Capabilities.UpdateRestrictions.Updatable : false
  entity SubscriptionFilter {
    key ID : String(36) not null;
    subscription_ID : String(36);
    fieldCode : String(255);
    value : String(40);
    valueText : String(120);
    flexField1 : String(255);
    flexField2 : String(255);
    flexField3 : String(255);
    flexField4 : String(255);
    flexField5 : String(255);
  };

  @cds.external : true
  @cds.persistence.skip : true
  @Capabilities.DeleteRestrictions.Deletable : false
  @Capabilities.InsertRestrictions.Insertable : false
  @Capabilities.UpdateRestrictions.Updatable : false
  entity UserProfile {
    key ID : String(36) not null;
    userId : String(256);
    userGroupIndicator : String(255);
    @odata.Precision : 7
    @odata.Type : 'Edm.DateTimeOffset'
    createdAt : Timestamp;
    createdBy : String(255);
    @odata.Precision : 7
    @odata.Type : 'Edm.DateTimeOffset'
    modifiedAt : Timestamp;
    modifiedBy : String(255);
  };
};

