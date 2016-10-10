/*global define*/

define(
    ['./EdisonTelemetrySeries'],
    function (EdisonTelemetrySeries) {
        "use strict";

        var SOURCE = "Edison.source";

        function EdisonTelemetryProvider(adapter, $q) {
            console.log("EdisonTelemetryProvider")
            var subscribers = {};

            // Used to filter out requests for telemetry
            // from some other source
            function matchesSource(request) {
                console.log("matchesSource")
                return (request.source === SOURCE);
            }

            // Listen for data, notify subscribers
            adapter.listen(function (message) {
                var packaged = {};
                packaged[SOURCE] = {};
                packaged[SOURCE][message.id] =
                    new EdisonTelemetrySeries([message.value]);
                (subscribers[message.id] || []).forEach(function (cb) {
                    cb(packaged);
                });
            });



            return {
                requestTelemetry: function (requests) {
                    var packaged = {},
                        relevantReqs = requests.filter(matchesSource);

                    // Package historical telemetry that has been received
                    function addToPackage(history) {
                        console.log("addToPackage")
                        packaged[SOURCE][history.id] =
                            new EdisonTelemetrySeries(history.value);
                    }

                    // Retrieve telemetry for a specific measurement
                    function handleRequest(request) {
                        console.log("handleRequest")
                        var key = request.key;
                        return adapter.history(key).then(addToPackage);
                    }

                    packaged[SOURCE] = {};
                    return $q.all(relevantReqs.map(handleRequest))
                        .then(function () { return packaged; });
                },
                subscribe: function (callback, requests) {
                    var keys = requests.filter(matchesSource)
                        .map(function (req) { return req.key; });

                    function notCallback(cb) {
                        return cb !== callback;
                    }

                    function unsubscribe(key) {
                        subscribers[key] =
                            (subscribers[key] || []).filter(notCallback);
                        if (subscribers[key].length < 1) {
                            adapter.unsubscribe(key);
                        }
                    }

                    keys.forEach(function (key) {
                        subscribers[key] = subscribers[key] || [];
                        adapter.subscribe(key);
                        subscribers[key].push(callback);
                    });

                    return function () {
                        keys.forEach(unsubscribe);
                    };
                }
            };
        }

        return EdisonTelemetryProvider;
    }
);
