# ParfumoExtract - Solution Architecture

## Executive Summary

ParfumoExtract is a sophisticated web crawler designed to extract comprehensive fragrance data from Parfumo.com. The system employs ethical crawling practices, robust error handling, and efficient data storage using PostgreSQL.

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     ParfumoExtract System                    │
├─────────────────────────────────────────────────────────────
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Scraper    │───▶│   Parser     │───▶│   Storage    │  │
│  │   Engine     │    │   Engine     │    │   Engine     │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                    │                    │         │
│         ▼                    ▼                    ▼         │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │Rate Limiter  │    │Data Transform│    │  PostgreSQL  │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │               Orchestrator & Scheduler                │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Monitoring & Error Handling              │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Crawler Engine
- **Technology**: Axios + Cheerio
- **Purpose**: HTTP requests and HTML parsing
- **Features**:
  - User-agent rotation
  - Request retry with exponential backoff
  - Concurrent request limiting
  - Cookie and session management
  - Robots.txt compliance

### 2. Data Extraction Layer
- **Parser Engine**: Cheerio-based selectors
- **Data Points Extracted**:
  - Fragrance metadata (name, brand, year, type)
  - Olfactory pyramid (top, middle, base notes)
  - Ratings and performance metrics
  - Accords and characteristics
  - Seasonal/occasional suitability
  - Perfumer information

### 3. Database Layer
- **Technology**: PostgreSQL
- **Schema Design**: Normalized relational model
- **Key Tables**:
  - `fragrances`: Core fragrance information
  - `brands`: Perfume houses
  - `notes`: Individual scent notes
  - `fragrance_notes`: Note relationships with pyramid positions
  - `perfumers`: Fragrance creators
  - `accords`: Scent harmony profiles
  - `crawl_history`: Audit and tracking

### 4. Rate Limiting & Ethics
- **Politeness Delay**: 2-second minimum between requests
- **Concurrent Limits**: Maximum 2 parallel requests
- **Hourly Caps**: 1000 requests/hour
- **Retry Strategy**: Exponential backoff with jitter
- **User-Agent**: Identifies crawler purpose

## Data Flow

1. **Discovery Phase**
   - Crawl category pages
   - Extract fragrance URLs
   - Queue for detailed extraction

2. **Extraction Phase**
   - Fetch individual fragrance pages
   - Parse HTML structure
   - Extract structured data
   - Validate and transform

3. **Storage Phase**
   - Deduplicate entities
   - Normalize relationships
   - Transactional inserts
   - Update timestamps

4. **Quality Assurance**
   - Data validation
   - Duplicate detection
   - Error logging
   - Crawl statistics

## Technology Stack

### Core Technologies
- **Runtime**: Node.js 20+ with TypeScript
- **Web Scraping**: Axios, Cheerio
- **Database**: PostgreSQL 15+
- **Process Management**: PM2 (production)
- **Logging**: Pino
- **Testing**: Jest

### Key Libraries
- `p-limit`: Concurrency control
- `p-retry`: Resilient retries
- `user-agents`: User-agent rotation
- `robotparser`: Robots.txt compliance
- `dotenv`: Configuration management

## Deployment Architecture

### Development Environment
```bash
npm install
npm run db:migrate
npm run dev
```

### Production Environment
```bash
npm run build
npm run db:migrate
NODE_ENV=production npm start
```

### Docker Deployment
```yaml
version: '3.8'
services:
  crawler:
    build: .
    environment:
      - DATABASE_URL=postgresql://...
    depends_on:
      - postgres

  postgres:
    image: postgres:15-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data
```

## Scalability Considerations

### Horizontal Scaling
- Distributed queue system (Redis/RabbitMQ)
- Multiple crawler instances
- Load balancing with round-robin

### Vertical Scaling
- Connection pooling
- Batch processing
- Index optimization
- Query caching

### Data Volume Management
- Partitioned tables by date
- Archival strategy for old data
- Incremental crawling
- Delta updates only

## Security & Compliance

### Security Measures
- Environment variable secrets
- SQL injection prevention
- Rate limiting enforcement
- Input sanitization

### Legal Compliance
- Robots.txt adherence
- Terms of service respect
- No aggressive crawling
- Educational/research purpose declaration

## Monitoring & Maintenance

### Key Metrics
- Crawl success rate
- Response times
- Data quality scores
- Error rates
- Database performance

### Alerting Thresholds
- Failed requests > 10%
- Response time > 5 seconds
- Database connection failures
- Memory usage > 80%

## Error Handling Strategy

### Retry Logic
```typescript
// Exponential backoff with jitter
retryDelay = Math.min(
  baseDelay * Math.pow(2, attempt) + Math.random() * 1000,
  maxDelay
)
```

### Error Categories
1. **Transient**: Network timeouts, 503 errors → Retry
2. **Permanent**: 404, parsing failures → Log and skip
3. **Rate Limit**: 429 errors → Back off exponentially
4. **Critical**: Database failures → Alert and halt

## Data Quality Assurance

### Validation Rules
- Required fields presence
- Data type correctness
- Range validations (ratings 0-5)
- Relationship integrity
- Duplicate detection

### Data Enrichment
- Note categorization
- Brand normalization
- Perfumer deduplication
- Accord standardization

## Performance Optimizations

### Crawler Optimizations
- Connection keep-alive
- DNS caching
- Response compression
- Selective data extraction

### Database Optimizations
- Prepared statements
- Batch insertions
- Strategic indexing
- Connection pooling

## Future Enhancements

### Phase 2 Features
- GraphQL API layer
- Real-time change detection
- Machine learning for categorization
- Similar fragrance recommendations
- Data export APIs

### Phase 3 Features
- Multi-source aggregation
- Review sentiment analysis
- Trend analysis dashboard
- Predictive availability

## Operational Runbook

### Daily Operations
1. Check crawl statistics
2. Review error logs
3. Verify data quality
4. Monitor rate limits

### Weekly Tasks
1. Database vacuum
2. Performance analysis
3. Update detection rules
4. Security audit

### Incident Response
1. Identify failure pattern
2. Check rate limit status
3. Verify network connectivity
4. Review recent changes
5. Rollback if necessary

## Cost Estimation

### Infrastructure Costs (Monthly)
- VPS/Cloud Instance: $20-50
- PostgreSQL Database: $10-30
- Monitoring: $0-10
- Total: ~$30-90/month

### Operational Costs
- Development: Initial setup
- Maintenance: 2-4 hours/month
- Data storage growth: ~1GB/month

## Conclusion

ParfumoExtract provides a robust, scalable, and ethical solution for extracting fragrance data from Parfumo.com. The architecture prioritizes data quality, system reliability, and respectful crawling practices while maintaining flexibility for future enhancements.