## Context
     We've identified a critical issue in our integration tests where tests are expecting `ProblemDetails` responses from endpoints that use Minimal API helper methods like
   `SendNotFound(string)`, `SendConflict(string)`, etc. These methods return typed results (e.g., `NotFound<string>`, `Conflict<string>`) that serialize as plain JSON strings, NOT as
   ProblemDetails objects.

     This causes JSON deserialization errors in tests:

   System.Text.Json.JsonException : The JSON value could not be converted to
   Microsoft.AspNetCore.Mvc.ProblemDetails.


     ## Root Cause
     ASP.NET Core Minimal API's `TypedResults.NotFound(value)` and `TypedResults.Conflict(value)` return the value directly, not wrapped in ProblemDetails. Only `TypedResults.Problem()` returns
    ProblemDetails.

     ## Your Task
     Perform a comprehensive audit and fix of ALL integration tests in the TeensyROM project:

     ### Step 1: Scan All Endpoints
     1. Search through ALL endpoint files in `src/apps/api/src/TeensyRom.Api/Endpoints/`
     2. Identify every usage of the following methods:
        - `SendNotFound(string)`
        - `SendConflict(string)`
        - Any other `Send*` methods that pass a string parameter (except `SendProblem`)

     ### Step 2: Map Endpoints to Tests
     1. For each endpoint identified in Step 1, find its corresponding integration test(s) in `src/apps/api/src/TeensyRom.Api.Tests.Integration/`
     2. Identify test methods that call these endpoints and expect `ProblemDetails` or `ValidationProblemDetails` as the response type

     ### Step 3: Fix Each Test
     For each mismatched test, change:

     **FROM:**
     ```csharp
     var r = await client.GetAsync<SomeEndpoint, SomeRequest, ProblemDetails>(new SomeRequest { ... });

     r.Should().BeProblem()
         .WithStatusCode(HttpStatusCode.NotFound)
         .WithMessage("Some message");

   TO:

     var r = await client.GetAsync<SomeEndpoint, SomeRequest, string>(new SomeRequest { ... });

     r.Http.StatusCode.Should().Be(HttpStatusCode.NotFound);
     r.Content.Should().Be("Some message");

   Step 4: Create a Summary Report

   After fixing all tests, provide:

     - Total number of endpoints scanned
     - Number of endpoints using typed response methods (SendNotFound, SendConflict, etc.)
     - Number of integration tests fixed
     - List of all modified test files

   Important Guidelines

     - DO NOT change the endpoint implementations - they are using correct Minimal API behavior
     - ONLY fix the integration tests to match the actual response types
     - Ensure all assertions are updated (no more .BeProblem(), use direct assertions on r.Content and r.Http.StatusCode)
     - Run all integration tests after changes to verify fixes
     - Be thorough - scan EVERY endpoint and EVERY test file

   Success Criteria

     - All integration tests pass without JSON deserialization errors
     - No test expects ProblemDetails when the endpoint uses SendNotFound(string) or similar methods
     - Test assertions correctly validate the string response content and status codes