# TaskFlow Java backend (alternative)

Requires Java 17+ and Maven. This Spring Boot backend serves the same frontend from `src/main/resources/static` and provides `/api/tasks` endpoints. It uses in-memory demo storage; data resets when the Java server restarts. For Supabase persistence, use the supplied SQL schema and configure the primary Node.js backend as documented in the project README.

From this folder run:

```bash
mvn spring-boot:run
```

Open http://localhost:8080. The Java backend is an optional alternative; the easiest fully packaged run path remains the Node.js backend described in the parent README.
