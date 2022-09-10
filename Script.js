function init() {
    var eventsource;
    var msgsNode = document.getElementById("rc-messages");
    var boxesNode = document.getElementById("rc-boxes");
    var errorNode = DOM.element("div", {
        className: "alert alert-danger"
    });
    var infoNode = DOM.element("div", {
        className: "alert alert-info"
    });
    var boxes = Object.create(null);
    var boxList = [];
    var timerSecNode = document.querySelector(".rc-timer--sec").nextSibling;
    var timerMinNode = document.querySelector(".rc-timer--min").nextSibling;
    var timerHrNode = document.querySelector(".rc-timer--hr").nextSibling;
    var infoTimeout, errorTimeout;

    function printMessage(event) {
        if (event.type === "error") {
            errorNode.textContent = "ERROR: " + JSON.stringify(event.data);
            if (!errorNode.parentNode) {
                msgsNode.append(errorNode);
            }
            // Cancel any plan to hide the error node
            clearTimeout(errorTimeout);
        }
        if (event.type === "info") {
            infoNode.textContent = event.message;
            if (!infoNode.parentNode) {
                msgsNode.append(infoNode);
            }
            hideInfoNode();
        }
    }

    function hideErrorNode() {
        if (!errorTimeout) {
            errorTimeout = setTimeout(function() {
                errorNode.remove();
                errorTimeout = null;
            });
        }
    }

    function hideInfoNode() {
        // Cancel any previous timeout for hiding the info node,
        // and start a new timeout instead.
        clearTimeout(infoTimeout);
        infoTimeout = setTimeout(function() {
            infoNode.remove();
            infoTimeout = null;
        }, 3000);
    }

    function pad(num) {
        return num < 10 ? "0" + num : String(num);
    }

    /**
     * Compare function for Array#sort.
     *
     * @param {Box} a
     * @param {Box} b
     * @return {number}
     */
    function boxesCompare(a, b) {
        // Sort in descending order by highest total
        return b.freq.total - a.freq.total;
    }

    /**
     * Sort the box nodes on the page.
     *
     * This is called from main().
     */
    function resortBoxes() {
        var before, after;
        before = boxList
            .map(function(box) {
                return box.group;
            })
            .join(" ");
        // Sort the list
        boxList.sort(boxesCompare);
        after = boxList
            .map(function(box) {
                return box.group;
            })
            .join(" ");
        if (before === after) {
            // Avoid expensive reflow
            return;
        }
        fastdom.mutate(function() {
            // Create a fragment containing the boxes in order,
            // this implicitly temporarily removes them from the page.
            var frag = document.createDocumentFragment();
            var i;
            for (i = 0; i < boxList.length; i++) {
                frag.append(boxList[i].node);
            }
            // Add the boxes back to the page, in sorted order
            boxesNode.append(frag);
        });
    }

    /**
     * This is called from main().
     */
    function updateTimerTooltip() {
        var timer, elSec, elMin, elHr;
        elSec = Math.floor((DOM.now() - Frequency.start) / 1000);
        elHr = Math.floor(elSec / 3600);
        elSec -= elHr * 3600;
        elMin = Math.floor(elSec / 60);
        elSec -= elMin * 60;
        fastdom.mutate(function() {
            timerSecNode.dataset.value = pad(elSec);
            timerMinNode.dataset.value = pad(elMin);
            timerHrNode.dataset.value = pad(elHr);
        });
    }

    function Box(group) {
        // Start column
        var col = document.createElement("div");
        col.className = "col-md-4";

        // Start .card
        var card = document.createElement("div");
        card.className = "card rc-box";

        // Start .card > .card-body
        var body = document.createElement("div");
        body.className = "card-body";

        // Start .card > .card-body > .card-title
        var title = document.createElement("h5");
        title.className = "card-title rc-box-title";
        title.textContent = group;
        // End .card > .card-body > .card-title
        body.append(title);

        // Start .card > .card-body > .card-text
        var text = document.createElement("p");
        text.className = "card-text";
        text.textContent = "Total: ";

        var totalStat = document.createTextNode("0");
        text.append(totalStat);

        // End .card > .card-body > .card-text
        body.append(text);

        // End .card > .card-body
        card.append(body);
        // End .card
        col.append(card);

        // End column - add column to the page
        fastdom.mutate(function() {
            boxesNode.append(col);
        });

        // Keep reference to the outer-most node and group name
        // for sorting purposes. @see #resortBoxes
        this.node = col;
        this.group = group;

        this.statTextNodes = {
            Total: {
                count: totalStat,
                avg: null
            },
            "Past second": this.addStatNodes(text, "Past second"),
            "Past minute": this.addStatNodes(text, "Past minute"),
            "Past hour": this.addStatNodes(text, "Past hour")
        };
        this.freq = new Frequency({
                "Past second": 1000,
                "Past minute": 60 * 1000,
                "Past hour": 3600 * 1000
            },
            this.set.bind(this)
        );
    }
    /**
     * @private
     */
    Box.prototype.addStatNodes = function(parent, span) {
        var nodes = {
            count: document.createTextNode(".."),
            avg: document.createTextNode("..")
        };

        var statline = document.createElement("div");
        statline.className = "text-muted rc-box-statline";
        statline.append(document.createTextNode(span + ": "));
        statline.append(nodes.count);
        statline.append(document.createTextNode(" (avg: "));
        statline.append(nodes.avg);
        statline.append(document.createTextNode(")"));

        parent.append(statline);

        return nodes;
    };

    /**
     * NOTE: Writes to DOM. Call only in fastdom.mutate().
     *
     * This method is invoked as callback from Frequency#check.
     *
     * @param {string} span Label for time span
     * @param {number|null} count Current count in this time span
     * @param {number|null} avg Running average for this time span
     */
    Box.prototype.set = function(span, count, avg) {
        var textNodes = this.statTextNodes[span];
        if (!textNodes) {
            // Unknown span
            return;
        }
        if (count !== null) {
            // The count is only updated when a time span has been
            // completed. In intermediate updates, only the average
            // is updated.
            textNodes.count.nodeValue = count.toLocaleString();
        }
        if (avg !== null) {
            // Total doesn't need an average
            textNodes.avg.nodeValue = Math.round(avg).toLocaleString();
        }
    };

    /**
     * @param {Object<string, number>} spans Label for a millisecond count (e.g. "last hour": 3600*1000)
     * @param {Function} callback Publish statistics
     * @param {string} callback.span Label
     * @param {number|null} callback.count Current count
     * @param {number|null} callback.avg Running average
     */
    function Frequency(spans, callback) {
        if (!Frequency.start) {
            Frequency.start = DOM.now();
        }

        this.total = 0;
        this.start = Frequency.start;

        this.callback = callback;

        this.intervals = {};
        var label;
        for (label in spans) {
            this.intervals[label] = {
                span: spans[label],
                count: 0,
                since: Frequency.start
            };
        }

        Frequency.register(this);
    }
    /**
     * Shared starting point for all Frequency objects.
     * Our event stream creates Box and Frequency objects
     * on-demand for each wiki it encounters. By giving all
     * Frequency objects the same starting point it solves two
     * problems:
     *
     * - Naturally, the average gets more accurate as time goes on.
     *   However, because Frequency objects are created on-demand,
     *   there would be a bias if they have their own start time.
     *   For example, if after a wiki only has its first event
     *   after listening for 10 minutes, it should reflect right-away
     *   that it received 1 message in a total of 10 minutes, not
     *   1 message in a total of the last second when the Frequency
     *   object was created.
     * - By giving all objects the same 'start' point, the render
     *   of per-second and per-minute values is nicely in sync
     *   for all boxes on the page.
     */
    Frequency.start = null;

    Frequency.registry = [];
    Frequency.register = function(freq) {
        Frequency.registry.push(freq);
    };
    Frequency.checker = function() {
        for (var key in Frequency.registry) {
            Frequency.registry[key].check();
        }
    };
    Frequency.ensureChecker = (function() {
        var pending = false;

        function callback() {
            pending = false;
            Frequency.checker();
        }
        return function ensureChecker() {
            if (!pending) {
                pending = true;
                fastdom.mutate(callback);
            }
        };
    })();
    /**
     * @param {number} increment
     */
    Frequency.prototype.add = function(increment) {
        var key;
        this.total += increment;
        for (key in this.intervals) {
            this.intervals[key].count += increment;
        }
        Frequency.ensureChecker();
    };

    /**
     * NOTE: Writes to DOM. Call only from fastdom.mutate().
     *
     * This method is called from Frequency.ensureChecker().
     */
    Frequency.prototype.check = function() {
        var now, key, interval, ellapsed, count, avg, ellapsedTotal;
        now = DOM.now();
        ellapsedTotal = now - this.start;
        for (key in this.intervals) {
            interval = this.intervals[key];
            avg = this.total * (interval.span / ellapsedTotal);
            ellapsed = now - interval.since;
            if (ellapsed >= interval.span) {
                count = interval.count;
                // Reset
                interval.count = 0;
                interval.since = now;
                // Publish count and average
                this.callback(key, count, avg);
            } else {
                // Publish average only
                this.callback(key, null, avg);
            }
        }
        // Publish total
        this.callback("Total", this.total, null);
    };

    function main() {
        console.log("Starting...");
        // Set Frequency origin timestamp and start timer animations
        Frequency.start = DOM.now();
        fastdom.mutate(function() {
            document.documentElement.className = "rc-timers--start";
        });

        // The EventSource#onmessage handler will ensure a checker round
        // in the next paint frame (via fastdom) whenever a message is received.
        // Here, we also start an idle loop that ensures averages are updated
        // and boxes are sorted, even when no messages are received for a while.
        DOM.rIC(function idleUpdater() {
            Frequency.ensureChecker();
            resortBoxes();
            setTimeout(function() {
                DOM.rIC(idleUpdater);
            }, 3000);
        });
        DOM.rIC(function idleClockWriter() {
            updateTimerTooltip();
            setTimeout(function() {
                DOM.rIC(idleClockWriter);
            }, 100);
        });

        // Start RecentChange stream
        printMessage({
            type: "info",
            message: "Connecting..."
        });

        eventsource = new EventSource(
            "https://stream.wikimedia.org/v2/stream/recentchange"
        );
        eventsource.onopen = function() {
            printMessage({
                type: "info",
                message: "Connected!"
            });
        };
        eventsource.onerror = function(msg) {
            printMessage({
                type: "error",
                data: msg
            });
        };
        eventsource.onmessage = function(msg) {
            if (!boxes.global) {
                // If the global box doesn't exist yet, this must be
                // the first message. Create the global box.
                boxes.global = new Box("All wikis");
            }

            // Increment box for "All wikis"
            boxes.global.freq.add(1);

            try {
                // Parse message to determine which wiki it is from
                var wiki = JSON.parse(msg.data).server_name;
                var box = boxes[wiki];
                if (!box) {
                    // If we haven't seen a message from this wiki before,
                    // create a box for it.
                    box = boxes[wiki] = new Box(wiki);
                    boxList.push(box);
                }
                // Increment box for this wiki
                box.freq.add(1);
            } catch (e) {
                // Ignore JSON parse error
            }

            // If there was an error in the past, remove it, because
            // if we're receiving a message now, the error must have
            // resolved itself.
            if (errorNode.parentNode) {
                hideErrorNode();
            }
        };
    }

    main();
}

/**
 * @var DOM
 */
var DOM = {
    /**
     * @param {string} tagName
     * @param {Object} [props]
     * @return {Element}
     */
    element: function element(tagName, props) {
        var key;
        var node = document.createElement(tagName);
        if (props) {
            for (key in props) {
                node[key] = props[key];
            }
        }
        return node;
    },

    rIC: window.requestIdleCallback ?
        window.requestIdleCallback.bind(window) :
        setTimeout,

    /**
     * @return {number} Timestamp in milliseconds
     */
    now: (function() {
        var perf = window.performance;
        return perf.now ?
            function now() {
                // Use the new HR Time API where available
                return perf.now();
            } :
            Date.now;
    })()
};

// Polyfills
(function() {
    // For https://developer.mozilla.org/en-US/docs/Web/API/ChildNode/remove
    // From: https://github.com/jserz/js_piece/blob/master/DOM/ChildNode/remove()/remove().md
    if (!Element.prototype.hasOwnProperty("remove")) {
        Object.defineProperty(Element.prototype, "remove", {
            configurable: true,
            enumerable: true,
            writable: true,
            value: function remove() {
                if (this.parentNode) this.parentNode.removeChild(this);
            }
        });
    }

    // For https://developer.mozilla.org/en-US/docs/Web/API/ParentNode/append
    // Source: https://github.com/jserz/js_piece/blob/master/DOM/ParentNode/append()/append().md
    [
        Element.prototype,
        Document.prototype,
        DocumentFragment.prototype
    ].forEach(function(proto) {
        if (proto.hasOwnProperty("append")) {
            return;
        }
        Object.defineProperty(proto, "append", {
            configurable: true,
            enumerable: true,
            writable: true,
            value: function append() {
                var argArr = Array.prototype.slice.call(arguments),
                    docFrag = document.createDocumentFragment();

                argArr.forEach(function(argItem) {
                    var isNode = argItem instanceof Node;
                    docFrag.appendChild(
                        isNode ? argItem : document.createTextNode(String(argItem))
                    );
                });

                this.appendChild(docFrag);
            }
        });
    });
})();

init();