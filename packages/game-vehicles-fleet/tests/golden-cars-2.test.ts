import { describeGolden } from './helpers/golden'

// cars is the largest group: split in four files so each CI shard stays short
describeGolden('cars', { part: 2, of: 4 })
