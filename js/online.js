$(document).ready(function() {
  var lintError = null;
  CodeMirror.registerHelper("lint", "pegjs", function(text) {
    var found = [lintError];
    return found;
  });

  var KB      = 1024;
  var MS_IN_S = 1000;

  var parser;
  var parserSource       = null;

  var buildAndParseTimer = null;
  var parseTimer         = null;

  var oldGrammar        = null;
  var oldParserVar      = null;
  var oldOptionCache    = null;
  var oldOptionOptimize = null;
  var oldInput          = null;

  var editor = CodeMirror.fromTextArea($("#grammar").get(0), {
      lineNumbers: true,
      mode: "pegjs",
      gutters: ["CodeMirror-lint-markers"],
  });

  var inputEditor = CodeMirror.fromTextArea($("#input").get(0), {
      lineNumbers: true,
      gutters: ["CodeMirror-lint-markers"],
  });

  function buildSizeAndTimeInfoHtml(title, size, time) {
    return $("<span/>", {
      "class": "size-and-time",
      title:   title,
      html:    (size / KB).toPrecision(2) + "&nbsp;kB, "
                 + time + "&nbsp;ms, "
                 + ((size / KB) / (time / MS_IN_S)).toPrecision(2) + "&nbsp;kB/s"
    });
  }

  function buildErrorMessage(e) {
    return e.location !== undefined
      ? "Line " + e.location.start.line + ", column " + e.location.start.column + ": " + e.message
      : e.message;
  }

  function build() {
    editor.setOption("lint",false);
    oldGrammar        = getGrammar();
    oldParserVar      = $("#parser-var").val();
    oldOptionCache    = $("#option-cache").is(":checked");
    oldOptionOptimize = $("#option-optimize").val();

    $('#build-message').attr("class", "message progress").text("Building the parser...");
    $("#input").attr("disabled", "disabled");
    $("#parse-message").attr("class", "message disabled").text("Parser not available.");
    $("#output").addClass("disabled").text("Output not available.");
    $("#parser-var").attr("disabled", "disabled");
    $("#option-cache").attr("disabled", "disabled");
    $("#option-optimize").attr("disabled", "disabled");
    $("#parser-download").attr("disabled", "disabled");

    try {
      var timeBefore = (new Date).getTime();
      parserSource = peg.generate(getGrammar(), {
        cache:    $("#option-cache").is(":checked"),
        optimize: $("#option-optimize").val(),
        output:   "source"
      });
      var timeAfter = (new Date).getTime();

      parser = eval(parserSource);

      $("#build-message")
        .attr("class", "message info")
        .html("Parser built successfully.")
        .append(buildSizeAndTimeInfoHtml(
          "Parser build time and speed",
          getGrammar().length,
          timeAfter - timeBefore
        ));
      $("#input").removeAttr("disabled");
      $("#parser-var").removeAttr("disabled");
      $("#option-cache").removeAttr("disabled");
      $("#option-optimize").removeAttr("disabled");
      $("#parser-download").removeAttr("disabled");

      var result = true;
    } catch (e) {
      lintError = {
        from: CodeMirror.Pos(e.location.start.line - 1, e.location.start.column - 1),
        to: CodeMirror.Pos(e.location.end.line - 1, e.location.end.column - 1),
        message: e.message
      };
      editor.setOption("lint",true);
      $("#build-message").attr("class", "message error").text(buildErrorMessage(e));

      var result = false;
    }

    doLayout();
    return result;
  }

  function parse() {
    inputEditor.setOption("lint", false);
    oldInput = inputEditor.getValue();

    $("#input").removeAttr("disabled");
    $("#parse-message").attr("class", "message progress").text("Parsing the input...");
    $("#output").addClass("disabled").text("Output not available.");

    try {
      var timeBefore = (new Date).getTime();
      var output = parser.parse(inputEditor.getValue());
      var timeAfter = (new Date).getTime();

      $("#parse-message")
        .attr("class", "message info")
        .text("Input parsed successfully.")
        .append(buildSizeAndTimeInfoHtml(
          "Parsing time and speed",
          $("#input").val().length,
          timeAfter - timeBefore
        ));
      $("#output").removeClass("disabled").text(jsDump.parse(output));

      var result = true;
    } catch (e) {
      inputLintError = {
        from: CodeMirror.Pos(e.location.start.line - 1, e.location.start.column - 1),
        to: CodeMirror.Pos(e.location.end.line - 1, e.location.end.column - 1),
        message: e.message
      };
      inputEditor.setOption("lint", {
        getAnnotations: function() { return [inputLintError]},
      });
      $("#parse-message").attr("class", "message error").text(buildErrorMessage(e));
      var result = false;
    }

    doLayout();
    return result;
  }

  function buildAndParse() {
    build() && parse();
  }

  function scheduleBuildAndParse() {
    var nothingChanged = getGrammar() === oldGrammar
      && $("#parser-var").val() === oldParserVar
      && $("#option-cache").is(":checked") === oldOptionCache
      && $("#option-optimize").val() === oldOptionOptimize;
    if (nothingChanged) { return; }

    if (buildAndParseTimer !== null) {
      clearTimeout(buildAndParseTimer);
      buildAndParseTimer = null;
    }
    if (parseTimer !== null) {
      clearTimeout(parseTimer);
      parseTimer = null;
    }

    buildAndParseTimer = setTimeout(function() {
      buildAndParse();
      buildAndParseTimer = null;
    }, 500);
  }

  function scheduleParse() {
    if (inputEditor.getValue() === oldInput) { return; }
    if (buildAndParseTimer !== null) { return; }

    if (parseTimer !== null) {
      clearTimeout(parseTimer);
      parseTimer = null;
    }

    parseTimer = setTimeout(function() {
      parse();
      parseTimer = null;
    }, 500);
  }

  function doLayout() {
    /*
     * This forces layout of the page so that the |#columns| table gets a chance
     * make itself smaller when the browser window shrinks.
     */
    $("#left-column").height("0px");    // needed for IE
    $("#right-column").height("0px");   // needed for IE
    $("#left-column .CodeMirror").height("0px");
    $("#right-column .CodeMirror").height("0px");
    $("#input").height("0px");

    $("#left-column").height(($("#left-column").parent().innerHeight() - 2) + "px");     // needed for IE
    $("#right-column").height(($("#right-column").parent().innerHeight() - 2) + "px");   // needed for IE
    $("#left-column .CodeMirror").height(($("#left-column .CodeMirror").parent().parent().innerHeight() - 14) + "px");
    $("#right-column .CodeMirror").height(($("#right-column .CodeMirror").parent().parent().innerHeight() - 14) + "px");
  }

  function getGrammar() {
    return editor.getValue();
  }

  editor.on("change", scheduleBuildAndParse);

  inputEditor.on("change", scheduleParse)

  doLayout();
  $(window).resize(doLayout);

  $("#loader").hide();
  $("#content").show();

  $("#grammar, #parser-var, #option-cache, #option-optimize").removeAttr("disabled");
  
  buildAndParse();

  editor.refresh();
  editor.focus();
  inputEditor.refresh();
});
