
//-----------------------------------------------------------------------------------*
// Confidential and Proprietary
// Copyright 2026, HP
// All Rights Reserved
//-----------------------------------------------------------------------------------*
// Application Name : Sales Order
// Module           : User Scope
// Description      : Row-level authorization based on Customer Code + WBS Project
//
// HP User:
//   - Full access
//
// Customer User:
//   - READ only
//   - Can see only Sales Orders where:
//       Customer Code matches user's customer assignment
//       AND
//       WBS Project matches one of user's assigned projects
//   - Restricted fields are hidden
//
// Unknown / unsupported users:
//   - No access
//
// Technical users:
//   - Unrestricted
//
// MDM Relationship:
//
// User
//   |
//   +-- UserPartners
//   |      user_email = User.email
//   |      partnerid  = Customer Code
//   |      id         = Partner ID
//   |      partnertype = C for Customer
//   |
//   +-- UserProjects
//          partner_id = UserPartners.id
//          projectid  = WBS Project
//
//-----------------------------------------------------------------------------------*/

"use strict";

const cds = require("@sap/cds");

const SELECT = cds.ql.SELECT;
const LOG = cds.log("sales-order-user-scope");

const MDM_SERVICE_NAME = "hpbuysell_mdm_common_srv_dest";


//-----------------------------------------------------------------------------------*
// Configuration
//-----------------------------------------------------------------------------------*

const CONFIG =
    (cds.env.hpbuysell &&
        cds.env.hpbuysell.userScope) ||
    {};


//-----------------------------------------------------------------------------------*
// Mock user configuration
//-----------------------------------------------------------------------------------*

const MOCK_USERS_FILE =
    CONFIG.mockUsers || null;

const IS_PRODUCTION =
    cds.env.profiles?.includes("production") ||
    cds.env.production === true;



const toList = (value, fallback = []) => {

    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return fallback;
    }

    const list =
        Array.isArray(value)
            ? value
            : String(value).split(",");

    return list
        .map(entry => String(entry).trim())
        .filter(Boolean);
};



//-----------------------------------------------------------------------------------*
// Optional development email
//
// Used only when local dummy authentication provides a technical/non-email id.
// Example:
//
// HP_USER_SCOPE_DEV_EMAIL=customer.fabrikam@example.com
//
// Do NOT use this as a production authorization mechanism.
//-----------------------------------------------------------------------------------*

const DEV_EMAIL =
    process.env.HP_USER_SCOPE_DEV_EMAIL ||
    CONFIG.devEmail ||
    null;


//-----------------------------------------------------------------------------------*
// Scope cache
//-----------------------------------------------------------------------------------*

const USER_SCOPE_CACHE =
    new Map();

const USER_SCOPE_CACHE_TTL =
    Number(
        process.env.HP_USER_SCOPE_TTL ||
        CONFIG.ttl ||
        60 * 1000
    );


//-----------------------------------------------------------------------------------*
// MDM entity names
//-----------------------------------------------------------------------------------*

const USER_ENTITY_NAME =
    "User";

const USER_GROUP_ENTITY_NAME =
    "UserGroup";

const USER_PARTNER_ENTITY_NAME =
    "UserPartners";

const USER_PROJECT_ENTITY_NAME =
    "UserProjects";


//-----------------------------------------------------------------------------------*
// User scope paths
//-----------------------------------------------------------------------------------*

const SCOPE_PATHS = {

    // Sales Order header
    SalesOrders: {
        customer: ["customerCode"],
        project: ["wbsProjectCode"]
    },

    // Sales Order item
    SalesOrderItems: {
        customer: ["salesOrder", "customerCode"],
        project: ["salesOrder", "wbsProjectCode"]
    },

    // Sales Order acknowledgement
    SalesOrderAcknowledgements: {
        customer: ["salesOrder", "customerCode"],
        project: ["salesOrder", "wbsProjectCode"]
    },

    // Flat export projection
    SalesOrderSearchExport: {
        customer: ["customerCode"],
        project: ["wbsProjectCode"]
    }
};


//-----------------------------------------------------------------------------------*
// Entities where row-level scope is applied
//-----------------------------------------------------------------------------------*

const SCOPED_ENTITIES = [
    "SalesOrders",
    "SalesOrderItems",
    "SalesOrderAcknowledgements",
    "SalesOrderSearchExport"
];


//-----------------------------------------------------------------------------------*
// Fields hidden from Customer users
//-----------------------------------------------------------------------------------*

const CUSTOMER_HIDDEN = {

    SalesOrders: [
        "businessModel",
        "billTo",
        "payer",
        "salesOrderOrigin",
        "businessUnit",
        "hpPlant",
        "soRequisitionCreationDateTime",
        "salesOrderType",
        "simpleChangeProcessingInd"
    ],

    SalesOrderItems: [
        "originalPlannedReceiptDate",
        "soChangeInOrigin",
        "reasonForCancellation",
        "shippingPoint",
        "soAckOutOrigin",
        "storageLocation",
        "endSupplier",
        "specialDealFlagSo",
        "specialPriceIndicatorSo",
        "transitTime",
        "gtsHold",
        "hpPurchaseOrder",
        "hpPoLineItem",
        "hpBacklogNotes",
        "simpleChangeProcessingInd",
        "specialPriceIndicatorPo",
        "salesOrderType"
    ],

    SalesOrderAcknowledgements: [],

    SalesOrderSearchExport: []
};

//-----------------------------------------------------------------------------------*
// Customer-visible search filters
//
// Customer users can search only using fields explicitly exposed by the
// Customer search-filter specification.
//
// HP / technical users can use all configured filters.
//-----------------------------------------------------------------------------------*

const CUSTOMER_VISIBLE_FILTERS = [

    "hpSalesOrganization",

    "customerCode",
    "customerDescription",

    "customerOrder",
    "customerOrderDate",

    "customerPartNumber",

    "hpBuyerCode",
    "hpBuyerName",

    "hpCompanyCode",

    "hpPartDescription",
    "hpPartNumber",

    "hpSalesOrder",

    "lineId",

    "lineStatus",

    "salesOrderStatus",

    "soOrderDate",

    "wbsProjectCode"
];
// --------------------------------------------------------------------------------*
// Clear scope cache
//-----------------------------------------------------------------------------------*

function clearCache() {
    USER_SCOPE_CACHE.clear();

    LOG.info(
        "[sales-order-user-scope] User scope cache cleared"
    );
}


//-----------------------------------------------------------------------------------*
// Entity name
//-----------------------------------------------------------------------------------*

function getEntityName(req) {

    const name =
        req?.target?.name ||
        req?.query?.SELECT?.from?.ref?.[0] ||
        req?.entity;

    if (!name) {
        return null;
    }

    return String(name)
        .split(".")
        .pop();
}


//-----------------------------------------------------------------------------------*
// Technical user detection
//
// Same concept as Purchase Order.
//
// Technical callers include:
//   - CAP privileged users
//   - system-user
//   - internal-user
//
// These users are not human customer users whose scope should be narrowed.
//-----------------------------------------------------------------------------------*

function isTechnical(req) {

    const user =
        req?.user;

    if (!user) {
        return false;
    }

    if (
        user._is_privileged ||
        user.is_privileged
    ) {
        return true;
    }

    try {

        return (
            user.is("system-user") ||
            user.is("internal-user")
        );

    } catch (err) {

        // CAP user object without roles
        return false;
    }
}


//-----------------------------------------------------------------------------------*
// Get logged-in user's email
//
// MDM User is keyed by EMAIL.
//
// Priority:
//   1. req.user.attr.email
//   2. req.user.id
//
// A non-email value such as "admin" is NOT sent to MDM.
//-----------------------------------------------------------------------------------*

function getUserEmail(req) {

    const user =
        req?.user;

    const attr =
        user?.attr || {};

    const candidate =
        attr.email ||
        user?.email ||
        user?.id;

    if (
        !candidate ||
        typeof candidate !== "string"
    ) {
        return null;
    }

    const value =
        candidate.trim();

    if (!value) {
        return null;
    }

    // MDM User is keyed by email.
    //
    // Do not perform:
    //
    //   User.email = "admin"
    //
    // because "admin" is not an MDM email.
    if (!value.includes("@")) {

        if (DEV_EMAIL) {

            return String(
                DEV_EMAIL
            )
                .trim()
                .toLowerCase();
        }

        return null;
    }

    return value.toLowerCase();
}


//-----------------------------------------------------------------------------------*
// Normalize value
//-----------------------------------------------------------------------------------*

function normalize(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return null;
    }

    return String(value)
        .trim();
}


//-----------------------------------------------------------------------------------*
// Fail closed
//
// IMPORTANT:
// No MDM user / no email / unsupported user / MDM failure
// NEVER results in unrestricted access.
//-----------------------------------------------------------------------------------*

function failClosed(reason, email = null) {

    if (reason) {

        LOG.warn(
            `[sales-order-user-scope] ${reason}`
        );
    }

    return {

        email,

        groupIndicator: null,

        unrestricted: false,

        customerUser: false,

        assignments: [],

        customerIds: [],

        projectIds: [],

        reason
    };
}


//-----------------------------------------------------------------------------------*
// Read remote MDM entity safely
//
// MDM failures return ok:false.
//
// IMPORTANT:
// The caller can distinguish:
//
//   ok:true + []  -> MDM answered and there are no records
//
// from:
//
//   ok:false      -> MDM could not answer
//-----------------------------------------------------------------------------------*

async function readMdm(
    mdm,
    entityName,
    where
) {

    try {

        const target =
            (
                mdm.entities &&
                mdm.entities[entityName]
            ) ||
            entityName;

        const rows =
            (
                await mdm.run(
                    SELECT
                        .from(target)
                        .where(where)
                )
            ) || [];

        return {
            ok: true,
            rows
        };

    } catch (error) {

        LOG.warn(
            `[sales-order-user-scope] ` +
            `${entityName} unreadable - failing closed: ` +
            `${error.message}`
        );

        return {
            ok: false,
            rows: []
        };
    }
}

//-----------------------------------------------------------------------------------*
// Load mock MDM users
//
// Mock data is used only when mockUsers is configured and the application
// is NOT running with the production profile.
//
// Example:
//   cds watch --profile users
//
// Production always uses the real MDM Common Service.
//-----------------------------------------------------------------------------------*

let MOCK_USERS_CACHE = null;

function loadMockUsers() {

    if (!MOCK_USERS_FILE) {
        return null;
    }

    if (IS_PRODUCTION) {

        LOG.info(
            "[sales-order-user-scope] " +
            "Production profile detected - mock MDM disabled"
        );

        return null;
    }

    if (MOCK_USERS_CACHE) {
        return MOCK_USERS_CACHE;
    }

    try {

        const fs = require("fs");
        const path = require("path");

        const filePath =
            path.resolve(
                process.cwd(),
                MOCK_USERS_FILE
            );

        if (!fs.existsSync(filePath)) {

            LOG.warn(
                "[sales-order-user-scope] " +
                `Mock MDM file not found: ${filePath}`
            );

            return null;
        }

        MOCK_USERS_CACHE =
            JSON.parse(
                fs.readFileSync(
                    filePath,
                    "utf8"
                )
            );

        LOG.info(
            "[sales-order-user-scope] " +
            `Mock MDM users loaded from ${filePath}`
        );

        return MOCK_USERS_CACHE;

    } catch (error) {

        LOG.error(
            "[sales-order-user-scope] " +
            `Unable to load mock MDM users: ${error.message}`
        );

        return null;
    }
}

//-----------------------------------------------------------------------------------*
// Read mock MDM entity
//-----------------------------------------------------------------------------------*

async function readMock(
    entityName,
    where
) {

    try {

        const mockUsers =
            loadMockUsers();

        if (!mockUsers) {

            return {
                ok: false,
                rows: []
            };
        }

        const rows =
            mockUsers[entityName] || [];


        const filteredRows =
            rows.filter(
                row => {

                    if (!where) {
                        return true;
                    }

                    return Object.entries(where)
                        .every(
                            ([field, expected]) => {

                                return normalize(
                                    row[field]
                                ) === normalize(
                                    expected
                                );
                            }
                        );
                }
            );


        return {
            ok: true,
            rows: filteredRows
        };

    } catch (error) {

        LOG.warn(
            "[sales-order-user-scope] " +
            `Mock ${entityName} unreadable: ` +
            `${error.message}`
        );

        return {
            ok: false,
            rows: []
        };
    }
}



//-----------------------------------------------------------------------------------*
// Resolve MDM source
//-----------------------------------------------------------------------------------*

//-----------------------------------------------------------------------------------*
// Resolve user-scope source
//
// [users] profile:
//     mock/mdm-users.json
//
// Other profiles:
//     hpbuysell_mdm_common_srv_dest
//
// Production:
//     Always real MDM
//-----------------------------------------------------------------------------------*

async function getMdmSource() {

    //---------------------------------------------------------------------------*
    // 1. Use mock MDM for local user testing
    //---------------------------------------------------------------------------*

    if (
        MOCK_USERS_FILE &&
        !IS_PRODUCTION
    ) {

        const mockUsers =
            loadMockUsers();

        if (mockUsers) {

            LOG.info(
                "[sales-order-user-scope] " +
                "Using mock MDM user source"
            );

            return {

                read: (
                    entityName,
                    where
                ) =>
                    readMock(
                        entityName,
                        where
                    )
            };
        }

        LOG.warn(
            "[sales-order-user-scope] " +
            "Mock MDM configured but could not be loaded"
        );

        return null;
    }


    //---------------------------------------------------------------------------*
    // 2. Use real MDM Common Service
    //---------------------------------------------------------------------------*

    let mdm;

    try {

        mdm =
            await cds.connect.to(
                MDM_SERVICE_NAME
            );

    } catch (error) {

        LOG.warn(
            "[sales-order-user-scope] " +
            `Unable to connect to ${MDM_SERVICE_NAME}: ` +
            `${error.message}`
        );

        return null;
    }


    LOG.info(
        "[sales-order-user-scope] " +
        "Using real MDM Common Service"
    );


    return {

        read: (
            entityName,
            where
        ) =>
            readMdm(
                mdm,
                entityName,
                where
            )
    };
}


//-----------------------------------------------------------------------------------*
// Load user scope
//-----------------------------------------------------------------------------------*

async function loadUserScope(req) {

    //---------------------------------------------------------------------------*
    // 1. Technical user
    //---------------------------------------------------------------------------*

    if (isTechnical(req)) {

        LOG.info(
            "[sales-order-user-scope] " +
            "Technical user detected - unrestricted access"
        );

        return {

            email: null,

            groupIndicator: "HP",

            unrestricted: true,

            customerUser: false,

            assignments: [],

            customerIds: [],

            projectIds: [],

            reason: "technical-user"
        };
    }


    //---------------------------------------------------------------------------*
    // 2. Resolve email
    //---------------------------------------------------------------------------*

    const email =
        getUserEmail(req);

    if (!email) {

        return failClosed(
            "Unable to determine logged-in user's email",
            null
        );
    }


    //---------------------------------------------------------------------------*
    // 3. Cache
    //---------------------------------------------------------------------------*

    const cached =
        USER_SCOPE_CACHE.get(email);

    if (
        cached &&
        cached.expiresAt > Date.now()
    ) {

        return cached.scope;
    }


    //---------------------------------------------------------------------------*
    // 4. Connect to MDM
    //---------------------------------------------------------------------------*

    const source =
        await getMdmSource();

    if (!source) {

        // IMPORTANT:
        // Do NOT cache MDM connection failures.
        //
        // If MDM comes back on the next request,
        // authorization should be resolved again.

        return failClosed(
            `MDM unavailable for ${email}`,
            email
        );
    }


    try {

        //------------------------------------------------------------------------*
        // 5. Read User
        //------------------------------------------------------------------------*

        const userRead =
            await source.read(
                USER_ENTITY_NAME,
                {
                    email
                }
            );


        if (!userRead.ok) {

            return failClosed(
                `Unable to read MDM User for ${email}`,
                email
            );
        }


        const mdmUser =
            userRead.rows[0];


        if (!mdmUser) {

            // IMPORTANT:
            // Unknown user is NOT cached.
            //
            // A newly-created MDM user should become visible
            // without waiting for the cache TTL.

            return failClosed(
                `No MDM User found for ${email}`,
                email
            );
        }


        //------------------------------------------------------------------------*
        // 6. Determine user type
        //------------------------------------------------------------------------*

        const userGroupIndicator =
            normalize(
                mdmUser.userGroupIndicator
            )?.toUpperCase();


        LOG.info(
            `[sales-order-user-scope] ` +
            `User ${email} group indicator: ` +
            `${userGroupIndicator || "<blank>"}`
        );


        //------------------------------------------------------------------------*
        // 7. HP User
        //
        // HP users have unrestricted Sales Order access.
        //------------------------------------------------------------------------*

        if (
            userGroupIndicator === "HP"
        ) {

            const scope = {

                email,

                groupIndicator: "HP",

                unrestricted: true,

                customerUser: false,

                assignments: [],

                customerIds: [],

                projectIds: [],

                reason: "buyer-indicator"
            };


            USER_SCOPE_CACHE.set(
                email,
                {
                    scope,
                    expiresAt:
                        Date.now() +
                        USER_SCOPE_CACHE_TTL
                }
            );


            return scope;
        }


        //------------------------------------------------------------------------*
        // 8. Customer User
        //
        // Only C is accepted as a customer user.
        //
        // Unsupported indicators are denied.
        //------------------------------------------------------------------------*

        if (
            userGroupIndicator !== "C"
        ) {

            return failClosed(
                `Unsupported userGroupIndicator ` +
                `'${userGroupIndicator}' for ${email}`,
                email
            );
        }


        //------------------------------------------------------------------------*
        // 9. Read UserGroup
        //
        // Read for traceability / consistency with PO.
        //
        // It is not used to grant Customer access.
        //------------------------------------------------------------------------*

        const groupRead =
            await source.read(
                USER_GROUP_ENTITY_NAME,
                {
                    user_email: email
                }
            );


        if (!groupRead.ok) {

            return failClosed(
                `Unable to read UserGroup for ${email}`,
                email
            );
        }


        LOG.info(
            `[sales-order-user-scope] ` +
            `${email} has ` +
            `${groupRead.rows.length} group assignment(s)`
        );


        //------------------------------------------------------------------------*
        // 10. Read UserPartners
        //------------------------------------------------------------------------*

        const partnerRead =
            await source.read(
                USER_PARTNER_ENTITY_NAME,
                {
                    user_email: email
                }
            );


        if (!partnerRead.ok) {

            return failClosed(
                `Unable to read UserPartners for ${email}`,
                email
            );
        }


        const partners =
            partnerRead.rows || [];


        //------------------------------------------------------------------------*
        // 11. Customer partner assignments only
        //
        // partnertype C = Customer
        //------------------------------------------------------------------------*

        const customerPartners =
            partners.filter(
                partner => {

                    const type =
                        normalize(
                            partner.partnertype
                        )?.toUpperCase();

                    return type === "C";
                }
            );


        if (
            customerPartners.length === 0
        ) {

            return failClosed(
                `No customer partner assignment found for ${email}`,
                email
            );
        }


        //------------------------------------------------------------------------*
        // 12. Resolve Customer + WBS assignments
        //
        // IMPORTANT:
        //
        // Projects belong to the UserPartners.id.
        //
        // Therefore:
        //
        // UserPartners.id
        //       ↓
        // UserProjects.partner_id
        //
        // Do NOT pool all customers and all projects together.
        //------------------------------------------------------------------------*

        const assignments = [];


        for (
            const partner of customerPartners
        ) {

            const customerId =
                normalize(
                    partner.partnerid
                );

            const partnerId =
                normalize(
                    partner.id
                );


            if (
                !customerId ||
                !partnerId
            ) {

                LOG.warn(
                    `[sales-order-user-scope] ` +
                    `Invalid customer partner assignment for ${email}`
                );

                continue;
            }


            //----------------------------------------------------------------------*
            // Read projects belonging to THIS partner assignment
            //----------------------------------------------------------------------*

            const projectRead =
                await source.read(
                    USER_PROJECT_ENTITY_NAME,
                    {
                        partner_id: partnerId
                    }
                );


            if (!projectRead.ok) {

                // MDM answered neither "yes" nor "no".
                // Do not turn this into unrestricted access.

                return failClosed(
                    `Unable to read UserProjects for ` +
                    `${email}, partner ${partnerId}`,
                    email
                );
            }


            const projectIds = [
                ...new Set(
                    (projectRead.rows || [])
                        .map(
                            project =>
                                normalize(
                                    project.projectid
                                )
                        )
                        .filter(Boolean)
                )
            ];


            //----------------------------------------------------------------------*
            // Customer without WBS assignment gets NO scope
            //
            // Never create:
            //
            // customerCode = X
            //
            // without project restriction.
            //----------------------------------------------------------------------*

            if (
                projectIds.length === 0
            ) {

                LOG.warn(
                    `[sales-order-user-scope] ` +
                    `Customer ${customerId} has no ` +
                    `WBS project assignment`
                );

                continue;
            }


            assignments.push({

                customerId,

                partnerId,

                projectIds
            });
        }


        //------------------------------------------------------------------------*
        // 13. No valid Customer + WBS assignments
        //------------------------------------------------------------------------*

        if (
            assignments.length === 0
        ) {

            return failClosed(
                `No valid Customer + WBS Project assignments ` +
                `found for ${email}`,
                email
            );
        }


        //------------------------------------------------------------------------*
        // 14. Build scope
        //------------------------------------------------------------------------*

        const customerIds = [
            ...new Set(
                assignments.map(
                    assignment =>
                        assignment.customerId
                )
            )
        ];


        const projectIds = [
            ...new Set(
                assignments.flatMap(
                    assignment =>
                        assignment.projectIds
                )
            )
        ];


        const scope = {

            email,

            groupIndicator: "C",

            unrestricted: false,

            customerUser: true,

            assignments,

            // Flattened values are useful for logging/debugging.
            //
            // Authorization itself uses assignments so that
            // Customer + Project pairing is preserved.
            customerIds,

            projectIds,

            reason: "customer-indicator"
        };


        LOG.info(
            `[sales-order-user-scope] ` +
            `Scope loaded for ${email}: ` +
            `${JSON.stringify(assignments)}`
        );


        //------------------------------------------------------------------------*
        // 15. Cache ONLY successful MDM resolution
        //------------------------------------------------------------------------*

        USER_SCOPE_CACHE.set(
            email,
            {
                scope,

                expiresAt:
                    Date.now() +
                    USER_SCOPE_CACHE_TTL
            }
        );


        return scope;


    } catch (error) {

        LOG.error(
            `[sales-order-user-scope] ` +
            `MDM user scope lookup failed for ${email}: ` +
            `${error.message}`
        );


        // IMPORTANT:
        // Do NOT cache MDM failures.
        //
        // The next request gets another chance to resolve
        // authorization from MDM.

        return failClosed(
            `MDM lookup failed for ${email}`,
            email
        );
    }
}


//-----------------------------------------------------------------------------------*
// Build row-level scope expression
//
// For one assignment:
//
//   customerCode = C1
//   AND
//   wbsProjectCode IN (P1, P2)
//
// For multiple assignments:
//
//   (C1 AND P1/P2)
//   OR
//   (C2 AND P3/P4)
//
// This preserves the Customer + WBS pairing.
//-----------------------------------------------------------------------------------*

function buildScopeExpression(
    req,
    scope
) {

    if (
        !scope ||
        scope.unrestricted
    ) {

        return null;
    }


    const entityName =
        getEntityName(req);


    const paths =
        SCOPE_PATHS[entityName];


    if (!paths) {

        // Fail closed.
        //
        // A customer user must NEVER receive an entity
        // for which we have not explicitly configured
        // the customer/project path.

        LOG.warn(
            `[sales-order-user-scope] ` +
            `No scope paths configured for entity ${entityName}`
        );

        return [
            {
                val: 1
            },
            "=",
            {
                val: 0
            }
        ];
    }


    const groups = [];


    for (
        const assignment of
            scope.assignments || []
    ) {

        const customerId =
            normalize(
                assignment.customerId
            );


        const projectIds = [
            ...new Set(
                (assignment.projectIds || [])
                    .map(normalize)
                    .filter(Boolean)
            )
        ];


        if (
            !customerId ||
            projectIds.length === 0
        ) {
            continue;
        }


        //----------------------------------------------------------------------*
        // Customer condition
        //----------------------------------------------------------------------*

        const customerCondition = [
            {
                ref: paths.customer
            },
            "=",
            {
                val: customerId
            }
        ];


        //----------------------------------------------------------------------*
        // Project condition
        //----------------------------------------------------------------------*

        const projectCondition = [];


        projectIds.forEach(
            (
                projectId,
                index
            ) => {

                if (index > 0) {

                    projectCondition.push(
                        "or"
                    );
                }


                projectCondition.push(
                    {
                        ref: paths.project
                    },
                    "=",
                    {
                        val: projectId
                    }
                );
            }
        );


        //----------------------------------------------------------------------*
        // Customer AND Project
        //----------------------------------------------------------------------*

        groups.push([
            "(",
            ...customerCondition,
            "and",
            "(",
            ...projectCondition,
            ")",
            ")"
        ]);
    }


    //------------------------------------------------------------------------*
    // No valid assignment -> 1 = 0
    //------------------------------------------------------------------------*

    if (
        groups.length === 0
    ) {

        return [
            {
                val: 1
            },
            "=",
            {
                val: 0
            }
        ];
    }


    //------------------------------------------------------------------------*
    // Multiple assignments -> OR
    //------------------------------------------------------------------------*

    const expression = [];


    groups.forEach(
        (
            group,
            index
        ) => {

            if (index > 0) {

                expression.push(
                    "or"
                );
            }

            expression.push(
                ...group
            );
        }
    );


    return expression;
}


//-----------------------------------------------------------------------------------*
// Apply row-level scope to READ query
//-----------------------------------------------------------------------------------*

function applyScopeFilter(
    req,
    scope
) {

    if (
        !scope ||
        scope.unrestricted
    ) {

        return;
    }


    const expression =
        buildScopeExpression(
            req,
            scope
        );


    if (!expression) {
        return;
    }


    const SELECT_QUERY =
        req.query?.SELECT;


    if (!SELECT_QUERY) {
        return;
    }


    //------------------------------------------------------------------------*
    // Existing OData/UI filter
    //
    // Existing user filter AND authorization filter.
    //
    // The user cannot widen the authorization scope.
    //------------------------------------------------------------------------*

    if (
        SELECT_QUERY.where &&
        SELECT_QUERY.where.length
    ) {

        SELECT_QUERY.where = [
            "(",
            ...SELECT_QUERY.where,
            ")",
            "and",
            ...expression
        ];

    } else {

        SELECT_QUERY.where =
            expression;
    }
}


//-----------------------------------------------------------------------------------*
// Hidden field lookup
//-----------------------------------------------------------------------------------*

function getHiddenFields(
    entityName
) {

    return new Set(
        CUSTOMER_HIDDEN[entityName] || []
    );
}


//-----------------------------------------------------------------------------------*
// Check whether a CQN expression references a hidden field
//-----------------------------------------------------------------------------------*

function containsHiddenField(
    expression,
    hiddenFields
) {

    if (!expression) {
        return false;
    }


    if (Array.isArray(expression)) {

        return expression.some(
            item =>
                containsHiddenField(
                    item,
                    hiddenFields
                )
        );
    }


    if (
        typeof expression === "object"
    ) {

        if (
            Array.isArray(
                expression.ref
            )
        ) {

            const lastRef =
                expression.ref[
                    expression.ref.length - 1
                ];


            if (
                hiddenFields.has(
                    lastRef
                )
            ) {

                return true;
            }
        }


        return Object.values(
            expression
        ).some(
            value =>
                containsHiddenField(
                    value,
                    hiddenFields
                )
        );
    }


    return false;
}


//-----------------------------------------------------------------------------------*
// Prevent Customer users from querying hidden fields
//-----------------------------------------------------------------------------------*

function assertReadableFilter(
    req,
    scope
) {

    if (
        !scope?.customerUser
    ) {

        return;
    }


    const entityName =
        getEntityName(req);


    const hiddenFields =
        getHiddenFields(
            entityName
        );


    if (
        hiddenFields.size === 0
    ) {

        return;
    }


    const query =
        req.query?.SELECT;


    if (!query) {
        return;
    }


    //------------------------------------------------------------------------*
    // WHERE
    //------------------------------------------------------------------------*

    if (
        containsHiddenField(
            query.where,
            hiddenFields
        )
    ) {

        req.reject(
            400,
            "You are not allowed to filter using restricted fields."
        );
    }


    //------------------------------------------------------------------------*
    // HAVING
    //------------------------------------------------------------------------*

    if (
        containsHiddenField(
            query.having,
            hiddenFields
        )
    ) {

        req.reject(
            400,
            "You are not allowed to use restricted fields in this query."
        );
    }


    //------------------------------------------------------------------------*
    // ORDER BY
    //------------------------------------------------------------------------*

    if (
        containsHiddenField(
            query.orderBy,
            hiddenFields
        )
    ) {

        req.reject(
            400,
            "You are not allowed to sort using restricted fields."
        );
    }
}


//-----------------------------------------------------------------------------------*
// Remove hidden fields from response
//-----------------------------------------------------------------------------------*

function stripHiddenFields(
    req,
    scope,
    data
) {

    if (
        !scope?.customerUser
    ) {

        return data;
    }


    const entityName =
        getEntityName(req);


    const hiddenFields =
        getHiddenFields(
            entityName
        );


    if (
        hiddenFields.size === 0 ||
        data === null ||
        data === undefined
    ) {

        return data;
    }


    const stripObject =
        object => {

            if (
                !object ||
                typeof object !== "object"
            ) {

                return object;
            }


            for (
                const field of hiddenFields
            ) {

                if (
                    Object.prototype.hasOwnProperty.call(
                        object,
                        field
                    )
                ) {

                    delete object[field];
                }
            }


            return object;
        };


    if (
        Array.isArray(data)
    ) {

        data.forEach(
            stripObject
        );

    } else {

        stripObject(data);
    }


    return data;
}


//-----------------------------------------------------------------------------------*
// Customer users are read-only
//
// HP / technical users are allowed.
// Customer users and unknown users are rejected.
//-----------------------------------------------------------------------------------*

async function assertBuyer(req) {

    const scope =
        await loadUserScope(req);


    //------------------------------------------------------------------------*
    // HP / technical
    //------------------------------------------------------------------------*

    if (
        scope.unrestricted
    ) {

        return scope;
    }


    //------------------------------------------------------------------------*
    // Customer
    //------------------------------------------------------------------------*

    if (
        scope.customerUser
    ) {

        req.reject(
            403,
            "Customer users have read-only access to Sales Orders."
        );
    }


    //------------------------------------------------------------------------*
    // Unknown / unsupported
    //------------------------------------------------------------------------*

    req.reject(
        403,
        "You are not authorized to perform this operation."
    );
}


//-----------------------------------------------------------------------------------*
// Customer action protection
//-----------------------------------------------------------------------------------*

async function assertCustomerReadOnly(req) {

    const scope =
        await loadUserScope(req);


    // HP / technical
    if (
        scope.unrestricted
    ) {

        return scope;
    }


    // Customer
    if (
        scope.customerUser
    ) {

        req.reject(
            403,
            "Customer users have read-only access to Sales Orders."
        );
    }


    req.reject(
        403,
        "You are not authorized to perform this operation."
    );
}


//-----------------------------------------------------------------------------------*
// Register handlers
//-----------------------------------------------------------------------------------*

function registerUserScope(srv) {

    //------------------------------------------------------------------------*
    // READ
    //------------------------------------------------------------------------*

    for (
        const entity of SCOPED_ENTITIES
    ) {

        srv.before(
            "READ",
            entity,
            async req => {

                const scope =
                    await loadUserScope(req);


                // Check hidden/restricted fields
                assertReadableFilter(
                    req,
                    scope
                );


                // Apply Customer + WBS scope
                applyScopeFilter(
                    req,
                    scope
                );
            }
        );


        srv.after(
            "READ",
            entity,
            async (
                data,
                req
            ) => {

                const scope =
                    await loadUserScope(req);


                return stripHiddenFields(
                    req,
                    scope,
                    data
                );
            }
        );
    }


    //------------------------------------------------------------------------*
    // CREATE / UPDATE / DELETE
    //------------------------------------------------------------------------*

    const writableEntities = [
        "SalesOrders",
        "SalesOrderItems",
        "SalesOrderAcknowledgements"
    ];


    for (
        const entity of writableEntities
    ) {

        srv.before(
            "CREATE",
            entity,
            assertBuyer
        );


        srv.before(
            "UPDATE",
            entity,
            assertBuyer
        );


        srv.before(
            "DELETE",
            entity,
            assertBuyer
        );
    }


    //------------------------------------------------------------------------*
    // Custom actions
    //------------------------------------------------------------------------*

    srv.before(
        "updateSalesOrderHeader",
        async req => {

            await assertCustomerReadOnly(
                req
            );
        }
    );


    srv.before(
        "updateSalesOrderItem",
        async req => {

            await assertCustomerReadOnly(
                req
            );
        }
    );


    srv.before(
        "cancelLine",
        "SalesOrderItems",
        async req => {

            await assertCustomerReadOnly(
                req
            );
        }
    );


    LOG.info(
        "[sales-order-user-scope] " +
        "User scope handlers registered"
    );
}

function getVisibleFilters(scope) {

    if (
        !scope ||
        scope.unrestricted
    ) {
        return null;
    }

    if (
        scope.customerUser
    ) {
        return CUSTOMER_VISIBLE_FILTERS;
    }

    return [];
}

//-----------------------------------------------------------------------------------*
// Exports
//-----------------------------------------------------------------------------------*

// module.exports = {

//     registerUserScope,

//     loadUserScope,

//     applyScopeFilter,

//     buildScopeExpression,

//     assertReadableFilter,

//     stripHiddenFields,

//     assertBuyer,

//     assertCustomerReadOnly,

//     getEntityName,

//     getUserEmail,

//     isTechnical,

//     clearCache,

//     SCOPE_PATHS,

//     CUSTOMER_HIDDEN,

//     SCOPED_ENTITIES
// };

module.exports = {

    registerUserScope,

    loadUserScope,

    applyScopeFilter,

    buildScopeExpression,

    assertReadableFilter,

    stripHiddenFields,

    assertBuyer,

    assertCustomerReadOnly,

    getEntityName,

    getUserEmail,

    isTechnical,

    clearCache,

    getVisibleFilters,

    SCOPE_PATHS,

    CUSTOMER_HIDDEN,

    CUSTOMER_VISIBLE_FILTERS,

    SCOPED_ENTITIES
};

