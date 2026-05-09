# The Verification Theatre

**What Verification Is, What It Could Be, What Becomes Possible**

Ivan Phan · Independent Researcher · [ORCID 0009-0003-1095-5855](https://orcid.org/0009-0003-1095-5855)

Paper 4 (closing) of **The Training Landscape** series

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.20091382.svg)](https://doi.org/10.5281/zenodo.20091382)
[![License: CC BY 4.0](https://img.shields.io/badge/License-CC_BY_4.0-lightgrey.svg)](https://creativecommons.org/licenses/by/4.0/)

---

## Abstract

AI labs market self-verification as a delivered capability. Independent measurement consistently fails to detect it as distinct from cheaper alternatives. This paper diagnoses the gap and specifies what would close it.

The diagnosis draws on four established traditions (auditing, science studies, cognitive psychology, expertise studies) to ground a single claim: verification is a developed capacity that depends on structural conditions. Current AI training fails to preserve each of these conditions through specific, documented mechanisms. The paper composes the preceding three papers' diagnoses into a constructive specification: four preconditions (architectural deliberation, training-signal grounding, infrastructure preservation, integration timing) that together provide the structural equivalent of the developmental conditions human verification requires.

The training-layer paradox names the three-stage compression through which multi-source training data becomes single-voice output. Cross-domain professional adoption data (medicine and legal) confirms that the human verification layer is shifting its own verification practice toward AI in the domains where independent verification matters most. Six falsifiable predictions with null hypotheses test whether the specific four-component cut is necessary.

The paper does not argue against AI deployment. It specifies what current marketing claims would require to become operationally true.

## Reading the paper

| Format | Link |
|--------|------|
| HTML (recommended) | [hip1.github.io/The-Verification-Theatre/the-verification-theatre.html](https://hip1.github.io/The-Verification-Theatre/the-verification-theatre.html) |
| PDF | [`the-verification-theatre.pdf`](the-verification-theatre.pdf) |
| Markdown source | [`the-verification-theatre.md`](the-verification-theatre.md) |

The HTML version includes a navigable table of contents, audience routing, and dark/light theme toggle.

## The Training Landscape series

| # | Paper | DOI |
|---|-------|-----|
| 1 | [Uncertainty Collapse in Post-Trained Language Models: Keep Calm or Carry On](https://hip1.github.io/Uncertainty-Collapse/uncertainty-collapse.html) | [10.5281/zenodo.19482051](https://doi.org/10.5281/zenodo.19482051) |
| 2 | [The Judgment Paradox: Disagreement Valuation, Annotation Pipelines, Synthetic Data, and the Case for Preservation](https://hip1.github.io/The-Judgment-Paradox/the-judgment-paradox.html) | [10.5281/zenodo.19594378](https://doi.org/10.5281/zenodo.19594378) |
| 3 | [The Tunnel Pipeline: What Gets Lost, What It Costs, and the Case for PARIA](https://hip1.github.io/The-Tunnel-Pipeline/the-tunnel-pipeline.html) | [10.5281/zenodo.19804186](https://doi.org/10.5281/zenodo.19804186) |
| 4 | **The Verification Theatre** (this paper) | [10.5281/zenodo.20091382](https://doi.org/10.5281/zenodo.20091382) |

Papers 1-3 diagnose specific failure modes. Paper 4 composes those diagnoses into a constructive specification.

## Key contributions

- **Verification taxonomy** (§3): External and internal verification distinguished, internal verification rehabilitated under structural conditions, composed into path 3. Resolves apparent contradictions in the self-correction literature.
- **Four-precondition composition** (§4): Architectural deliberation, training-signal grounding, infrastructure preservation, and integration timing specified as structural conditions for operationally warranted verification.
- **Training-layer paradox** (§6.2): Multi-source training data collapses into single-voice output through annotation consensus, helpfulness optimisation, and autoregressive inference. Prompted plurality reproduces the problem: surface diversity within frame-level uniformity.
- **Specialist-generalist orchestration** (§5): The same types of preconditions govern the orchestrator and the specialists, though operational instantiation differs at each level.
- **PARIA consistency check** (§4.5): Path 3 satisfies, at the level of specification, the judgment conditions its source papers identify as necessary.
- **Six falsifiable predictions** (§8) with null hypotheses designed to cost the framework something specific if they hold.

## By audience

- **ML / AI safety**: §3-5, §8 — taxonomy, preconditions, orchestration, predictions
- **Trust, policy, governance**: §6-7 — warranted trust, cost externalisation, cross-domain professional adoption, training-layer paradox
- **Cognitive science / expertise studies**: §2, §4.4 — four-traditions grounding, Kahneman/Klein valid-environment mapping
- **Auditing / institutional accountability**: §2.1, §2.5, §4.3 — Power's verification-theatre parallel, multi-source verification history, infrastructure preservation

## Building the HTML

```bash
node build-paper.mjs the-verification-theatre.md the-verification-theatre.html --template vt-template.html
```

Requires Node.js. The build script converts markdown to a self-contained HTML file with the paper reading shell (TOC drawer, audience tags, key-sentence highlights, dark/light toggle).

## Repository structure

```
the-verification-theatre.md          # Canonical source (single file for reading and building)
the-verification-theatre.html        # Rendered HTML (steel blue theme)
the-verification-theatre.pdf         # Print version (light theme, A4)
vt-template.html                     # HTML template with VT colour scheme
build-paper.mjs                      # Markdown → HTML build script
.zenodo.json                         # Zenodo deposit metadata
CITATION.cff                         # Citation metadata
LICENSE                              # CC BY 4.0
```

## Citation

```bibtex
@article{phan2026verification,
  title     = {The Verification Theatre: What Verification Is, What It Could Be, What Becomes Possible},
  author    = {Phan, Ivan},
  year      = {2026},
  note      = {The Training Landscape series, Paper 4. Preprint.},
  doi       = {10.5281/zenodo.20091382},
  url       = {https://hip1.github.io/The-Verification-Theatre/the-verification-theatre.html},
  license   = {CC BY 4.0}
}
```

## Licence

This work is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
