# Account Settings Plugins

This folder contains plugins that extend the **Account → Profile** page.

## Plugin contract
Each plugin is a CommonJS module that exports:

```js
module.exports = {
  id: 'uniqueId',
  title: 'Human Title',
  view: 'partial-name',
  order: 100, // optional
  getValues({ user }) { ... }, // optional
  schema(Joi) { ... }, // optional
  apply({ user, values }) { return { metaData: {...} }; }, // optional
  registerRoutes(router, deps) { ... } // optional
}
```

### Notes
- `view` must match a Handlebars partial in `views/partials/account-plugins/`.
- `schema(Joi)` validates `plugins[<id>]` from the profile form.
- `apply()` should return `{ metaData: { ... } }` to merge into user metaData.
- `registerRoutes()` can add custom routes under `/account/*`.

## Example
See `template.js` for a minimal example.
