# AI vendor review

Reviewed July 14, 2026. This is an engineering due-diligence record, not legal approval. Production configuration rejects any external processor that is not named in `APPROVED_AI_PROVIDERS`; an organization must document its own contract, DPA, region, subprocessors, incident terms, and lawful basis before adding a provider.

| Provider | Observed official position | Engineering disposition for applicant documents |
| --- | --- | --- |
| Google Gemini API | Unpaid services may use inputs/outputs for product improvement and human review. Paid API content is not used for product improvement, but prompts and responses are logged for abuse monitoring; Google states a 55-day period. | Block by default. Consider only paid service after DPA, transfer/region, 55-day retention, and sensitive-data review. Never use unpaid quota for applicant data. |
| GroqCloud | Inference content is not retained by default except temporary reliability/abuse logs for up to 30 days. Organization controls can enable zero data retention; usage metadata remains. | Conditional. Require organization-wide ZDR, persistence features disabled, DPA/security review, U.S. processing approval, and a dedicated key. |
| OpenRouter | OpenRouter prompt logging/training opt-ins are off by default and per-request ZDR routing is available, but requests are also governed by the selected downstream model provider. Metadata remains. | Conditional. The adapter sends `provider.zdr=true`; also require account guardrails, fixed provider/model allowlists, logging disabled, downstream-provider review, DPA, and a dedicated key. |
| SambaNova Cloud | Published terms permit processing customer content to provide the service or as required by law and place privacy notices/consent responsibility on the customer. Public support statements say prompts/outputs are not stored, but the reviewed binding material did not state a precise retention period. | Block pending a signed DPA/order form that specifies retention, deletion, training exclusion, regions, subprocessors, breach notice, and audit rights. |
| Cerebras Inference | Official support states prompt content, requests/responses, chat/transaction logs, and model inputs/outputs are not retained; organization/account data and usage metrics remain. Terms say service content is not used for model training. | Conditional. Require DPA/security and region/subprocessor validation, contractual confirmation of the support-page statement, incident terms, and a dedicated key. |
| Mistral API | Default API handling may retain input/output for 30 rolling days for abuse monitoring. Training and privacy controls exist; ZDR is available only on eligible Scale plans/stateless calls, and Labs models can be used for training regardless of opt-out. | Block by default. Consider only eligible paid stateless API with ZDR and training disabled, Labs disabled, DPA/region/subprocessor review, and a dedicated key. |

## Required approval record

For each approved provider, record the legal entity, product/tier, model IDs, endpoint/region, DPA date, retention and deletion behavior, training setting, human-access conditions, subprocessors, transfer mechanism, breach-notification term, key owner, spend limit, approval owner, approval date, and next review date. Re-review on provider, model, endpoint, or terms changes and at least annually.

## Sources

- [Gemini API terms](https://ai.google.dev/gemini-api/terms) and [abuse monitoring](https://ai.google.dev/gemini-api/docs/usage-policies)
- [GroqCloud data controls](https://console.groq.com/docs/your-data)
- [OpenRouter data collection](https://openrouter.ai/docs/guides/privacy/data-collection) and [zero data retention](https://openrouter.ai/docs/guides/features/zdr)
- [SambaNova legal agreements](https://sambanova.ai/legal-agreements) and [Fast API Program terms](https://sambanova.ai/hubfs/23945802/PubSec/fast-api-program-tos.pdf)
- [Cerebras retention statement](https://support.cerebras.net/articles/1811589793-does-cerebras-retain-my-data) and [terms](https://cloud.cerebras.ai/terms)
- [Mistral privacy controls](https://docs.mistral.ai/admin/monitor-comply/privacy-data-controls), [privacy policy](https://legal.mistral.ai/terms/privacy-policy), and [ZDR eligibility](https://help.mistral.ai/en/articles/347612-can-i-activate-zero-data-retention-zdr)
