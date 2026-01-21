'use strict';

const fs = require('fs');
const path = require('path');

const PLUGIN_DIR = path.join(__dirname, '..', 'plugins', 'account-settings');

let cached = null;

function loadPlugins() {
    if (!fs.existsSync(PLUGIN_DIR)) {
        return [];
    }

    let entries = fs.readdirSync(PLUGIN_DIR).filter(name => name.endsWith('.js'));
    let plugins = [];

    for (let name of entries) {
        let filePath = path.join(PLUGIN_DIR, name);
        let plugin = require(filePath); // eslint-disable-line global-require

        if (!plugin || !plugin.id || !plugin.view || !plugin.title) {
            continue;
        }

        plugins.push({
            order: 100,
            ...plugin
        });
    }

    plugins.sort((a, b) => (a.order || 100) - (b.order || 100));
    return plugins;
}

function getPlugins() {
    if (!cached) {
        cached = loadPlugins();
    }
    return cached;
}

function buildViewData({ user, pluginValues, pluginErrors, csrfToken }) {
    const plugins = getPlugins();
    return plugins.map(plugin => {
        let values = pluginValues && pluginValues[plugin.id];
        if (!values && typeof plugin.getValues === 'function') {
            values = plugin.getValues({ user }) || {};
        }
        return {
            id: plugin.id,
            title: plugin.title,
            view: plugin.view,
            values: values || {},
            errors: (pluginErrors && pluginErrors[plugin.id]) || {},
            csrfToken
        };
    });
}

function validatePlugins({ user, input, Joi }) {
    const plugins = getPlugins();
    const pluginValues = {};
    const pluginErrors = {};
    let metaDataUpdates = {};

    for (let plugin of plugins) {
        let raw = (input && input[plugin.id]) || {};
        let values = raw;

        if (typeof plugin.schema === 'function') {
            let schema = plugin.schema(Joi);
            let result = schema.validate(raw, {
                abortEarly: false,
                convert: true,
                allowUnknown: false
            });
            values = result.value || {};

            if (result.error && result.error.details) {
                let errors = {};
                result.error.details.forEach(detail => {
                    let key = detail.path && detail.path.length ? detail.path.join('.') : 'value';
                    if (!errors[key]) {
                        errors[key] = detail.message;
                    }
                });
                pluginErrors[plugin.id] = errors;
            }
        }

        pluginValues[plugin.id] = values;

        if (!pluginErrors[plugin.id] && typeof plugin.apply === 'function') {
            let updates = plugin.apply({ user, values }) || {};
            if (updates.metaData && typeof updates.metaData === 'object') {
                metaDataUpdates = { ...metaDataUpdates, ...updates.metaData };
            }
        }
    }

    return { pluginValues, pluginErrors, metaDataUpdates };
}

function registerRoutes(router, deps) {
    const plugins = getPlugins();
    for (let plugin of plugins) {
        if (typeof plugin.registerRoutes === 'function') {
            plugin.registerRoutes(router, deps);
        }
    }
}

module.exports = {
    getPlugins,
    buildViewData,
    validatePlugins,
    registerRoutes
};
