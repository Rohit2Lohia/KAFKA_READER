function init() {
    console.log("Starting Kafka Reader");

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
    
    function main1() {
        console.log("In main1");

    }

    function main() {
        console.log("In main");

    }

    function main2() {
        console.log("In main2");

    }

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

init();