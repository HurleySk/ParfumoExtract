# ParfumoExtract

A sophisticated web crawler for extracting comprehensive fragrance data from Parfumo.com. Built with TypeScript, Node.js, and PostgreSQL.

## Features

- **Ethical Crawling**: Respects robots.txt, implements rate limiting, and identifies itself properly
- **Comprehensive Data Extraction**:
  - Fragrance metadata (name, brand, year, type, concentration)
  - Olfactory pyramid (top, middle, base notes)
  - Ratings and performance metrics (longevity, sillage)
  - Perfumers and creators
  - Accords and scent profiles
  - Seasonal and occasional suitability
- **Robust Architecture**:
  - Concurrent request handling with configurable limits
  - Automatic retry with exponential backoff
  - Transaction-based database operations
  - Comprehensive error handling and logging
- **Data Quality**:
  - Deduplication at entity level
  - Data validation and normalization
  - Incremental updates support

## Prerequisites

- Node.js 20+
- PostgreSQL 15+
- npm or yarn

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/ParfumoExtract.git
cd ParfumoExtract
```

2. Install dependencies:
```bash
npm install
```

3. Set up PostgreSQL database:
```bash
createdb parfumo_db
```

4. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your database credentials and crawler settings
```

5. Run database migrations:
```bash
npm run db:migrate
```

## Usage

### Basic Usage

Run the crawler with default settings:
```bash
npm run crawl
```

### Command Line Options

```bash
npm run crawl -- --max-pages 10 --skip-existing true
```

Options:
- `--max-pages <number>`: Maximum number of listing pages to crawl (default: 5)
- `--start-url <url>`: Custom starting URL for crawling
- `--skip-existing <true|false>`: Skip fragrances already in database (default: true)
- `--category <categories>`: Comma-separated list of categories to filter

### Development Mode

Run in watch mode for development:
```bash
npm run dev
```

### Production Deployment

Build and run in production:
```bash
npm run build
npm start
```

## Configuration

### Environment Variables

Key configuration options in `.env`:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/parfumo_db

# Crawler Settings
CRAWLER_DELAY_MS=2000              # Delay between requests
CRAWLER_CONCURRENT_REQUESTS=2       # Max parallel requests
CRAWLER_MAX_RETRIES=3              # Retry attempts for failed requests

# Rate Limiting
RATE_LIMIT_REQUESTS_PER_MINUTE=30
RATE_LIMIT_REQUESTS_PER_HOUR=1000

# Logging
LOG_LEVEL=info                     # debug, info, warn, error
```

## Database Schema

The crawler uses a normalized PostgreSQL schema:

- **fragrances**: Core fragrance information
- **brands**: Perfume houses and manufacturers
- **notes**: Individual scent components
- **fragrance_notes**: Note relationships with pyramid positions
- **perfumers**: Fragrance creators
- **accords**: Scent harmony profiles
- **seasons/occasions**: Suitability mappings
- **crawl_history**: Audit trail

See `/src/database/schema.sql` for complete schema definition.

## API Usage

The crawler can also be used programmatically:

```typescript
import { CrawlerOrchestrator } from './src/crawler/orchestrator';

const crawler = new CrawlerOrchestrator();

await crawler.crawl({
  maxPages: 10,
  skipExisting: true,
  startUrl: 'https://www.parfumo.com/en/perfumes/men'
});
```

## Data Access

Query the PostgreSQL database directly:

```sql
-- Find top-rated fragrances
SELECT f.name, b.name as brand, f.rating_value, f.rating_count
FROM fragrances f
JOIN brands b ON f.brand_id = b.id
WHERE f.rating_count > 100
ORDER BY f.rating_value DESC
LIMIT 10;

-- Get fragrance with notes
SELECT f.name, n.name as note, fn.position
FROM fragrances f
JOIN fragrance_notes fn ON f.id = fn.fragrance_id
JOIN notes n ON fn.note_id = n.id
WHERE f.name = 'Aventus';
```

## Monitoring

### Crawl Statistics

View crawl history and performance:
```sql
SELECT
  DATE(created_at) as date,
  COUNT(*) as urls_crawled,
  SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful,
  AVG(duration_ms) as avg_duration_ms
FROM crawl_history
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### Logs

Logs are written to:
- Console (development)
- `logs/crawler.log` (production)

## Docker Deployment

Build and run with Docker:

```bash
docker build -t parfumo-extract .
docker run -e DATABASE_URL=postgresql://... parfumo-extract
```

Or use Docker Compose:

```bash
docker-compose up
```

## Performance

- Processes ~500-1000 fragrances per hour (with 2-second delay)
- Database storage: ~1MB per 100 fragrances
- Memory usage: ~200-400MB during operation
- Network: ~100KB per fragrance page

## Error Handling

The crawler implements multiple error recovery strategies:

1. **Transient Errors**: Automatic retry with exponential backoff
2. **Rate Limiting**: Automatic throttling when limits reached
3. **Parse Errors**: Skip and log, continue with next item
4. **Database Errors**: Transaction rollback, item retry

## Contributing

1. Fork the repository
2. Create your feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## Testing

Run the test suite:
```bash
npm test
```

## Legal & Ethical Considerations

- This crawler is designed for educational and research purposes
- Always respect website terms of service
- Implements polite crawling with delays and rate limits
- Identifies itself properly in User-Agent headers
- Does not bypass any access restrictions

## Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Verify PostgreSQL is running
   - Check connection string in `.env`
   - Ensure database exists

2. **Rate Limit Errors**
   - Increase `CRAWLER_DELAY_MS`
   - Reduce `CRAWLER_CONCURRENT_REQUESTS`

3. **Parsing Errors**
   - Website structure may have changed
   - Check parser selectors in `/src/crawler/parser.ts`

4. **Memory Issues**
   - Reduce `--max-pages` parameter
   - Process in smaller batches

## License

MIT License - See LICENSE file for details

## Disclaimer

This tool is for educational purposes only. Users are responsible for complying with Parfumo.com's terms of service and applicable laws. The authors are not responsible for misuse of this software.

## Support

For issues, questions, or contributions, please open an issue on GitHub.