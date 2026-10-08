use crate::provider::{ApiKeyEntry, ApiKeyStrategy};

/// Select one key from a provider key pool.
///
/// `random_seed` is passed in explicitly so request-time randomness can be
/// supplied by the router while unit tests stay deterministic. `cursor` is a
/// per-provider round-robin cursor.
pub fn select_api_key(
    entries: &[ApiKeyEntry],
    strategy: Option<ApiKeyStrategy>,
    fallback: &str,
    cursor: &mut usize,
    random_seed: u64,
) -> String {
    let valid: Vec<&ApiKeyEntry> = entries
        .iter()
        .filter(|entry| !entry.key.trim().is_empty())
        .collect();

    if valid.is_empty() {
        return fallback.to_string();
    }

    match strategy.unwrap_or_default() {
        ApiKeyStrategy::Random => {
            let index = (random_seed % valid.len() as u64) as usize;
            valid[index].key.clone()
        }
        ApiKeyStrategy::RoundRobin => {
            let index = *cursor % valid.len();
            *cursor = (*cursor).wrapping_add(1);
            valid[index].key.clone()
        }
        ApiKeyStrategy::Weighted => {
            let total_weight: u64 = valid
                .iter()
                .map(|entry| u64::from(entry.weight.max(1)))
                .sum();
            let mut point = random_seed % total_weight;
            for entry in valid {
                let weight = u64::from(entry.weight.max(1));
                if point < weight {
                    return entry.key.clone();
                }
                point -= weight;
            }
            fallback.to_string()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn missing_weight_defaults_to_one() {
        let entry: ApiKeyEntry = serde_json::from_value(serde_json::json!({
            "key": "sk-a"
        }))
        .unwrap();
        assert_eq!(entry.weight, 1);
    }

    fn entry(key: &str, weight: u32) -> ApiKeyEntry {
        ApiKeyEntry {
            key: key.to_string(),
            weight,
        }
    }

    #[test]
    fn falls_back_when_pool_is_empty_or_blank() {
        let mut cursor = 0;
        assert_eq!(
            select_api_key(&[], None, "fallback", &mut cursor, 7),
            "fallback"
        );
        assert_eq!(
            select_api_key(&[entry("", 1)], None, "fallback", &mut cursor, 7),
            "fallback"
        );
    }

    #[test]
    fn round_robin_advances_even_when_seed_is_reused() {
        let entries = vec![entry("a", 1), entry("b", 1), entry("c", 1)];
        let mut cursor = 0;
        let selected: Vec<String> = (0..5)
            .map(|_| {
                select_api_key(
                    &entries,
                    Some(ApiKeyStrategy::RoundRobin),
                    "fallback",
                    &mut cursor,
                    0,
                )
            })
            .collect();
        assert_eq!(selected, ["a", "b", "c", "a", "b"]);
    }

    #[test]
    fn random_uses_the_supplied_seed() {
        let entries = vec![entry("a", 1), entry("b", 1), entry("c", 1)];
        let mut cursor = 0;
        assert_eq!(
            select_api_key(
                &entries,
                Some(ApiKeyStrategy::Random),
                "fallback",
                &mut cursor,
                1,
            ),
            "b"
        );
        assert_eq!(
            select_api_key(
                &entries,
                Some(ApiKeyStrategy::Random),
                "fallback",
                &mut cursor,
                4,
            ),
            "b"
        );
    }

    #[test]
    fn weighted_selection_respects_weights() {
        let entries = vec![entry("a", 1), entry("b", 3)];
        let mut cursor = 0;
        let selected: Vec<String> = (0..4)
            .map(|seed| {
                select_api_key(
                    &entries,
                    Some(ApiKeyStrategy::Weighted),
                    "fallback",
                    &mut cursor,
                    seed,
                )
            })
            .collect();
        assert_eq!(selected, ["a", "b", "b", "b"]);
    }
}
