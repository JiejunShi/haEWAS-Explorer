# Heterogeneity-Adjusted EWAS Explorer (v1.0)

**Heterogeneity-Adjusted EWAS Explorer** is a web resource for exploring heterogeneity-adjusted epigenome-wide association study (haEWAS) results and methylation heterogeneity signals inferred from standard DNA methylation arrays.

The platform uses the CpG-specific Methylation Average-to-Heterogeneity Conversion Model Set ([A2H](https://github.com/ChaorongC/A2H)) to infer methylation heterogeneity measures from array-derived average methylation. This framework enables existing EPIC and 450K methylation datasets to be reanalyzed without additional sequencing.

## Key Features

- **Association Summary:** Summarizes significant loci identified by conventional EWAS, haEWAS, or both across curated human phenotypes and methylation measures.

- **Associated Loci Browser:** Supports phenotype-specific exploration of associated loci through interactive Manhattan plots and searchable result tables.

- **A2H Matrix Converter:** Converts user-provided EPIC or 450K average methylation matrices into CpG-level CAMDA and CHALM estimates for downstream haEWAS analysis.

- **Data Download:** Provides harmonized association results and related summary data for download.

## Why haEWAS?

Conventional array-based EWAS typically represents DNA methylation using average methylation. However, the same average methylation level can arise from different distributions of methylated DNA molecules, alleles, or cellular subpopulations.

Methylation heterogeneity captures this additional distributional information. Although it can be measured directly from read-level sequencing data, such data are unavailable for most population-scale cohorts. A2H addresses this limitation by learning CpG-specific relationships between average methylation and heterogeneity-aware measures from deeply sequenced reference methylomes and transferring these relationships to standard methylation array data.


## Website Sections

| Section | Description |
| --- | --- |
| **Home** | Introduces haEWAS, A2H, and the purpose of the resource |
| **Statistics** | Summarizes EWAS-, haEWAS-, and commonly identified loci across phenotypes |
| **Explore** | Provides interactive Manhattan plots and searchable association tables |
| **Converter** | Applies A2H models to user-provided EPIC or 450K methylation matrices |
| **Download** | Provides harmonized association results and supporting data |
| **Citation** | Provides citation information for the haEWAS study and Explorer |

## Matrix Conversion

The online converter accepts methylation matrices derived from Illumina EPIC or 450K arrays. A2H applies CpG-specific conversion models to estimate CAMDA and CHALM values from array-measured average methylation.

The resulting matrices can be used as inputs for heterogeneity-adjusted epigenome-wide association analyses.


## Citation

If you use this resource or the haEWAS framework in your research, please cite:

> Shengwei Li#, Chaorong Chen#, Shuting Zhou, Shengying Wang, Ya Allen Cui, Wei Li*, Jiejun Shi*. Methylation  heterogeneity reveals hidden epigenome–phenotype associations.

---
© 2026 **Heterogeneity-Adjusted EWAS Explorer Team**. All rights reserved.

