# Local type stubs

Skyfield and jplephem ship without type information. These stubs cover **only** the parts of their APIs the pipeline uses, so mypy and basedpyright check every call instead of treating results as `Any`. Anything not listed here is a type error, so adding a new library call means stubbing it first, against the library source.

The stubs are checked against the pinned versions in `uv.lock` (Skyfield 1.55, jplephem 2.24). Tests that use real DE441 data catch any drift between a stub and the runtime library.
