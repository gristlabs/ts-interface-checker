## v1.0.1 (2021-10-11)
- Add support for rest types in tuples, and for the type `unknown`.

## v1.0.0 (2021-04-14)
- Support reporting of multiple nested errors.
- Changes Checker.validate() to return an array of errors.

## v0.2.1 (2021-02-25)
- Fix reporting of extraneous properties with unions and intersections.

## v0.2.0 (2021-02-21)
- Adds support for index signatures.
- Avoids infinite recursion when creating checkers for recursive types.
- Fixes strict checks when inheritance is involved.

## v0.1.11 - v0.1.13 (2020-05-17 - 2020-08-04)
- Adds CheckerT interface for type guard support.
- Adds support for interesections of types.
- Fixes VError inheritance from Error.
