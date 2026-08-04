# Editing study content

## Vignettes

`config/vignettes.json` contains the 32 scenarios (NA baseline rows from
the source sheet are excluded). Keep IDs in order from `v01` through
`v32`. Each vignette must include its title, body, condition label, assist
label, display tags, and these metadata fields:

- `task_type` — `information-seeking` | `brainstorming` | `feedback` | `validation`
- `ai_role` — `supporting` | `executing`
- `knowledge_type` — `generic` | `org-specific`
- `impact_level` — `personal` | `team-level`

Tag icons live in `public/tags/`.

Optional jitter values can be added as `task_type_jitter_v`,
`directedness_jitter_v`, `data_access_jitter_v`, and
`visibility_jitter_v`. Missing jitter values are intentionally stored as
null.

Changing vignette IDs or factor metadata requires regenerating the
500-participant assignment table:

```bash
npm run generate:counterbalance
```

The generator fails instead of writing an invalid design unless every
condition receives 125 exposures and the within-participant and positional
balance checks pass. Each participant sees eight vignettes (two per task
type).

## Questions

`config/questions.json` is the single source of truth for the six
shared questions and response scale.

Do not change the `responseColumn` values after data collection begins:

- `q1_value_feedback`
- `q2_seek_feedback`
- `q3_incorporate_feedback`
- `q4_comfortable_feedback`
- `q5_express_frustrations`
- `q6_rather_work_without`

Run `npm test`, `npm run lint`, and `npm run build` after editing either
configuration file.
