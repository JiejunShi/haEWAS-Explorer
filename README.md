# Heterogeneity-Adjusted EWAS Explorer (v1.0)

**Heterogeneity-Adjusted EWAS Explorer** is a web portal for the exploration, visualization, and **transformation** of DNA methylation data. By implementing the **Heterogeneity-Adjusted (haEWAS)** framework, this platform enables the identification of phenotype-associated CpG markers driven by methylation heterogeneity (**CHALM** and **CAMDA**) — signals typically masked in conventional Beta-value-based Epigenome-Wide Association Studies (EWAS).

## Key Features

* **Online Matrix Converter:** Seamlessly transform standard methylation Beta-value arrays (EPIC/850k or HM450k) into Heterogeneity-Adjusted matrices (CHALM & CAMDA) using our high-performance cloud engine.
* **Global Statistics Dashboard:** Visualizes the interactive donut charts and grouped bar plots, comparing haEWAS-specific discoveries against conventional EWAS results across 40+ phenotypes.
* **Interactive Manhattan Plots:** Dynamic genome-wide association views seamlessly linked to data tables. Users can click any data point on the plot to instantly filter the corresponding statistics in the table below.

## Regenerating Statistics

After replacing or updating CSV files under `data/downloads/`, run one of:

`node generate_stats.js`

or

`python generate_stats.py`

This rebuilds `data/downloads/summary_stats.json` from the current `Group`, `haEWAS_Driver`, and `gene_region` columns.

Example for a remote/server-side source directory:

`node generate_stats.js --input /disk65t/lisw/projects/EWAS/data/4.EWAS/0.CAMDA_new/Fig_new/summary_statistics/output_summary_processed_filtered --output /disk65t/lisw/projects/EWAS/data/4.EWAS/0.CAMDA_new/Fig_new/summary_statistics/summary_stats.json`

## Citation

If you use this explorer or the haEWAS framework in your research, please cite:

> A. et al. (2026). Correcting methylation heterogeneity improves epigenome-wide discovery of phenotype-associated loci.*

---
© 2026 **Heterogeneity-Adjusted EWAS Explorer Team**. All rights reserved.*
