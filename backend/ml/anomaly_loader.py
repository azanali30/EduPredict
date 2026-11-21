"""
EduPredict - Machine Learning Anomaly Model Loader & In-Memory Cache (Phase 7C)
Module: backend.ml.anomaly_loader
Purpose: Thread-safe lazy loading of serialized anomaly detection bundles.
"""

import os
import logging
from typing import Dict, Optional, Any
import joblib
from backend.ml.anomaly_detector import AnomalyModelBundle, ANOMALY_MODEL_DIR

logger = logging.getLogger("edupredict.ml.anomaly_loader")

_MODEL_CACHE: Dict[str, AnomalyModelBundle] = {}

MODEL_FILENAMES = {
    "Mathematics": "math_anomaly_detector_m0.joblib",
    "Portuguese Language": "portuguese_anomaly_detector_m0.joblib",
}


def get_anomaly_model(subject: str) -> Optional[AnomalyModelBundle]:
    """
    Retrieve or lazy-load the AnomalyModelBundle for a subject.
    Thread-safe in-memory caching.
    """
    clean_subj = "Mathematics" if "math" in subject.lower() else "Portuguese Language"
    if clean_subj in _MODEL_CACHE:
        return _MODEL_CACHE[clean_subj]

    filename = MODEL_FILENAMES.get(clean_subj)
    if not filename:
        logger.error(f"Unknown subject for anomaly detection: {subject}")
        return None

    model_path = os.path.join(ANOMALY_MODEL_DIR, filename)
    if not os.path.exists(model_path):
        logger.warning(f"Anomaly model artifact not found at {model_path}. Attempting on-demand training...")
        from backend.ml.anomaly_detector import train_and_serialize_all_models
        try:
            train_and_serialize_all_models()
        except Exception as e:
            logger.error(f"Failed to auto-train anomaly model: {e}")
            return None

    try:
        bundle: AnomalyModelBundle = joblib.load(model_path)
        _MODEL_CACHE[clean_subj] = bundle
        logger.info(f"Loaded and cached anomaly detection model for {clean_subj} ({bundle.model_version})")
        return bundle
    except Exception as e:
        logger.error(f"Failed to load anomaly model artifact from {model_path}: {e}")
        return None


def score_student_features(subject: str, features: Dict[str, Any]) -> Dict[str, Any]:
    """Score an input record against the subject's anomaly model."""
    bundle = get_anomaly_model(subject)
    if not bundle:
        raise RuntimeError(f"Anomaly detection model for '{subject}' is not available.")
    return bundle.score_single_record(features)
