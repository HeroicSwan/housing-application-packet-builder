# Agency configuration

Housing Application Packet Builder keeps a housing starter configuration, but each organization can extend it without changing application code.

## Configure an organization

Sign in as an administrator and open **Admin → Agency configuration**. Add:

- **Custom fields** for values that belong on a case (text, long text, date, number, or currency). Optional validation rules support `minLength` and `pattern`.
- **Workflow definitions** as a JSON array of stages. A definition with key `case_management` replaces the starter case-status list for that organization.
- **Document profiles** for agency document categories. Each profile can provide a local extraction prompt and required/validation metadata.

Custom case fields appear on the case client page. In the template editor they are available as `custom.<field-key>` mapping paths. This lets an agency map its own values into an agency PDF or generated packet.

## Configuration export/import

The export action downloads JSON containing only field definitions, workflow definitions, and document profiles. It does not include customer records, uploaded files, access tokens, or other secrets. Import is intended for moving configuration between local environments; review the JSON before applying it.

## Requirements and document categories

Program requirements and uploaded-document categories accept agency-defined names. Starter categories are suggestions only. Keep category keys stable after production use so existing requirement rules, document profiles, and template mappings continue to match.

## Delivery integrations

Program submission destinations support email, provider API, portal API, and generic HTTPS webhook delivery. Configure the endpoint and authentication secret through the protected administrator workflow. A webhook is a transport adapter, not a built-in provider contract; the receiving agency must document its request schema, authentication, retries, and idempotency behavior.

## Before production

Every organization still needs to validate its own PDF template, field mappings, retention policy, reviewer roles, delivery endpoint, accessibility workflow, and legal/privacy requirements. The starter housing configuration is a working example, not an approval for any particular agency.
