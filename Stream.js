/** @license MIT License (c) copyright 2010-2013 original author or authors */

/**
 * Licensed under the MIT License at:
 * http://www.opensource.org/licenses/mit-license.php
 *
 * @author: Brian Cavalier
 * @author: John Hann
 */

var async = require('./async');

module.exports = Stream;

Stream.of = of;
Stream.empty = empty;

function Stream(emitter) {
	this._emitter = emitter;
}

function of(x) {
	return new Stream(function(next, end) {
		var subscribed = true;

		async(function() {
			if(!subscribed) {
				return;
			}

			var error;
			try {
				next(x);
			} catch(e) {
				error = e;
			}

			callSafely(end, error);

			return function() {
				subscribed = false;
			}
		});
	});
}

function empty() {
	return new Stream(function(next, end) {
		async(end);
	});
}

var proto = Stream.prototype = {};

proto.constructor = Stream;

proto.each = function(next, end) {
	return this._emitter(next, end);
};

proto.map = function(f) {
	var stream = this._emitter;
	return new Stream(function(next, end) {
		stream(function(x) {
			next(f(x));
		}, end);
	});
};

proto.ap = function(stream2) {
	return this.flatMap(function(f) {
		return stream2.map(f);
	});
};

proto.flatMap = function(f) {
	var stream = this._emitter;
	return new Stream(function(next, end) {
		stream(function(x) {
			f(x).each(next, end);
		}, end);
	});
};

proto.flatten = function() {
	return this.flatMap(identity);
};

proto.filter = function(predicate) {
	var stream = this._emitter;
	return new Stream(function(next, end) {
		stream(function(x) {
			predicate(x) && next(x);
		}, end);
	});
};

proto.merge = function(other) {
	// TODO: Should this accept an array?  a stream of streams?
	var stream = this._emitter;
	return new Stream(function(next, end) {
		stream(next, end);
		other.each(next, end);
	});
};

proto.concat = function(other) {
	// TODO: Should this accept an array?  a stream of streams?
	var stream = this._emitter;
	return new Stream(function(next, end) {
		stream(next, function(e) {
			e ? callSafely(end, e) : other.each(next, end);
		});
	});
};

proto.tap = function(f) {
	var stream = this._emitter;
	return new Stream(function(next, end) {
		stream(function(x) {
			f(x);
			next(x);
		}, end);
	});
};

proto.delay = function(ms) {
	var stream = this._emitter;
	return new Stream(function(next, end) {
		stream(function(x) {
			setTimeout(function() {
				next(x);
			}, ms||0);
		}, end);
	});
};

proto.debounce = function(interval) {
	var nextEventTime = interval;
	var stream = this._emitter;

	return new Stream(function(next, end) {
		stream(function(x) {
			var now = Date.now();
			if(now >= nextEventTime) {
				nextEventTime = now + interval;
				next(x);
			}
		}, end);
	});
};

proto.throttle = function(interval) {
	var cachedEvent, throttled;
	var stream = this._emitter;

	return new Stream(function(next, end) {
		stream(function(x) {
			cachedEvent = x;

			if(!throttled) {
				throttled = setTimeout(function() {
					throttled = void 0;
					next(x);
				}, interval);
			}
		}, end);
	});
};

proto['catch'] = function(f) {
	var stream = this._emitter;
	return new Stream(function(next, end) {
		stream(next, function(e1) {
			var error;
			if(e1 != null) {
				try {
					next(f(e1));
				} catch(e2) {
					error = e2;
				}
			}

			if(error != null) {
				callSafely(end, error);
			}
		});
	});
};

proto.reduce = function(f, initial) {
	var stream = this._emitter;
	return new Stream(function(next, end) {
		var value = initial;
		stream(function(x) {
			value = f(value, x);
		}, function(e) {
			if(e == null) {
				next(value);
			}
			callSafely(end, e);
		});
	});
};

proto.scan = function(f, initial) {
	return this.map(function(x) {
		return initial = f(initial, x);
	});
};

function callSafely(f, x) {
	return f && f(x);
}

function identity(x) {
	return x;
}