

using {hpbuysell.otc.salesorder as so} from './hpbuysell-otc-salesorder-model';

using from '@cap-js/change-tracking';

//-----------------------------------------------------------------------------------*
// Sales order header
//-----------------------------------------------------------------------------------*
// The identifier in the annotation forms the object id every header entry carries,
// which is what the View History tab groups and filters on.
//-----------------------------------------------------------------------------------*

annotate so.SalesOrders with @changelog: [hpSalesOrder] {
  
    hpNotesToCustomer @changelog;
}


annotate so.SalesOrderItems with @changelog: [
    salesOrder.hpSalesOrder,
    lineId
] {
    salesPrice            @changelog;
    salesPriceUnit        @changelog;
    specialDealFlagSo     @changelog;
    hpNotesToCustomer     @changelog;
    hpBacklogNotes        @changelog;
    reasonForCancellation @changelog       : [reasonForCancellation.description];
}
