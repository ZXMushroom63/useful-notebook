const colorRegex = /^!color=(\S+?)$/gm;
const checkboxRegex = /^- \[([ xX])\] \S/m;
const saveFile = async () => {
    const fileHandle = await window.showSaveFilePicker();
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(getSerializeableStateObject()));
    await writable.close();
};
const openFile = async () => {
    const [fileHandle] = await window.showOpenFilePicker();
    const file = await fileHandle.getFile();
    const contents = await file.text();
    try {
        state = JSON.parse(contents);
    } catch (error) {
        state = {
            name: "Load Error 🙁",
            content: "!color=red\nThe notebook file you selected was invalid.\\\nError: " + error,
            width: 300,
            height: 300,
            x: 50,
            lx: 0,
            ly: 0,
            y: 50,
            children: []
        }
    };
    position = state;
    loadParentProps();
    reloadUI();
};
var lastMouseEvent = { x: 0, y: 0 };
var latestHostBB = { top: 0, left: 0, height: 0, width: 0 };
var mRenderer;
var state = JSON.parse(localStorage.getItem("data") || JSON.stringify(
    {
        name: "My Notebook",
        content: "Click on the title of a note to rename it. You can also drag notes.\n- Right click to edit the markdown of a note.\n- `Shift + A` to add a note at your cursor.\n- Press `TAB` while hovering over a note to enter it\n- Press `SHIFT + TAB` to exit the current note.\n- Press `BACKSPACE` or `DEL` while hovering over a note to delete it.\n- Use `CTRL+S` and `CTRL+O` to save and load notebooks.\n- Put `!color=red` to change the color of a note.\n- Press `0` when not focused on any element to teleport to the main note. \\\n\\\n\\\n\\\nMade by [ZXMushroom63](https://github.com/ZXMushroom63)",
        width: 500,
        height: 300,
        x: 50,
        y: 50,
        children: []
    }
));
function loadParentProps() {
    const toDo = [[state, state]];
    while (toDo.length > 0) {
        const currentItem = toDo[0];
        currentItem[0].__parent = currentItem[1];
        toDo.shift();
        toDo.push(...currentItem[0].children.map(x => [x, currentItem[0]]));
    }
}
loadParentProps();
var position = state;
var startParams = new URLSearchParams(location.search);
console.log(startParams);
if (startParams.has("startPage")) {
    var startPage = startParams.get("startPage");
    console.log(startPage);
    position = position.children.find(x => x.name === startPage) || position;
}
if (startParams.has("bg")) {
    var background = startParams.get("bg");
    document.body.style.backgroundColor = background;
    document.documentElement.style.backgroundColor = background;
}
var observers = [];
function makeNodeHTML(struct) {
    var startPos;
    var node = document.createElement("div");
    var title = document.createElement("span");
    node.classList.add("node");
    node._struct = struct;
    title.classList.add("aTitle");
    title.innerText = struct.name;
    title.spellcheck = false;
    function dragHandler(e) {
        if (struct === position) {
            latestHostBB = node.getBoundingClientRect();
        }
        node.style.left = struct.x + (e.x - startPos.x) + "px";
        node.style.top = struct.y + (e.y - startPos.y) + "px";
        document.querySelectorAll("line").forEach(line => line._reload());
    }
    function stopDragHandler(e) {
        if (struct === position) {
            latestHostBB = node.getBoundingClientRect();
        }
        struct.x += (e.x - startPos.x);
        struct.y += (e.y - startPos.y);
        node.style.left = struct.x + "px";
        node.style.top = struct.y + "px";
        node.removeAttribute("data-grabbing");
        window.removeEventListener("mousemove", dragHandler);
        window.removeEventListener("mouseup", stopDragHandler);
    }
    title.addEventListener("mousedown", (e) => {
        startPos = e;
        node.setAttribute("data-grabbing", "yes");
        window.addEventListener("mousemove", dragHandler);
        window.addEventListener("mouseup", stopDragHandler);
    })
    title.addEventListener("keyup", () => {
        struct.name = title.innerText.replaceAll("\n", "");
        reloadLocationUI();
    });
    title.addEventListener("blur", () => {
        title.innerText = title.innerText.replaceAll("\n", "");
    });
    node.addEventListener("mouseup", () => {
        struct.width = parseInt(node.style.width.replace("px", ""));
        struct.height = parseInt(node.style.height.replace("px", ""));
        document.querySelectorAll("line").forEach(line => line._reload());
    });
    node.addEventListener("mousemove", () => {
        node.scrollLeft = 0;
        node.scrollTop = 0;
    });
    node.addEventListener("keyup", () => {
        node.scrollLeft = 0;
        node.scrollTop = 0;
    });
    node.addEventListener("mouseleave", () => {
        struct.width = parseInt(node.style.width.replace("px", ""));
        struct.height = parseInt(node.style.height.replace("px", ""));
        node.scrollLeft = 0;
        node.scrollTop = 0;
    });
    title.contentEditable = true;
    var editor = document.createElement("div");
    editor.spellcheck = false;
    editor.classList.add("editor");
    node.style.setProperty("--colordata", "white");
    function processMarkdown(content) {
        var result = colorRegex.exec(content);
        if (result) {
            node.style.setProperty("--colordata", result[1]);
        }
        content = content.replace(colorRegex, "");
        return content;
    }
    function setStateOfCheckboxAtIndex(content, idx, value) {
        const lines = content.split("\n");
        var checkboxIdx = 0;
        var success = false;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const match = checkboxRegex.exec(line);
            if (match) {
                if (checkboxIdx === idx) {
                    if (value) {
                        lines[i] = line.replace(/- \[([ ])\]/m, "- [X]");
                    } else {
                        lines[i] = line.replace(/- \[([xX])\]/m, "- [ ]");
                    }
                    success = true;
                    break;
                }
                checkboxIdx++;
            }
        }
        return success ? lines.join("\n") : content;
    }
    function registerCheckboxes() {
        editor.querySelectorAll("input[type=checkbox]").forEach((checkbox, checkboxIndex) => {
            checkbox.disabled = false;
            checkbox.addEventListener("input", () => {
                struct.content = setStateOfCheckboxAtIndex(struct.content, checkboxIndex, checkbox.checked);
            });
        });
    }
    editor.innerHTML = marked.parse(processMarkdown(struct.content), { renderer: mRenderer });
    registerCheckboxes();
    editor.addEventListener("contextmenu", (e) => {
        if (!e._editing) {
            e.preventDefault();
            editor.contentEditable = true;
            editor.innerText = struct.content.replaceAll(" ", " ");
            editor.focus();
            editor.click();
            editor._editing = true;
        }
    });
    editor.addEventListener("keyup", () => {
        if (editor._editing) {
            struct.content = editor.innerText.replaceAll(" ", " ");
        }
    });
    editor.addEventListener("blur", () => {
        editor.innerHTML = marked.parse(processMarkdown(struct.content), { renderer: mRenderer });
        registerCheckboxes();
        editor._editing = false;
        editor.contentEditable = false;
    });
    node.addEventListener("mousedown", (e) => { e.stopPropagation() });
    node.appendChild(title);
    node.appendChild(editor);
    if (struct === position) {
        window.onresize = () => {
            latestHostBB = node.getBoundingClientRect();
            document.querySelectorAll("line").forEach(line => line._reload());
        }
        window.onresize();
    }
    node.style.left = struct.x + "px";
    node.style.top = struct.y + "px";
    node.style.width = struct.width + "px";
    node.style.height = struct.height + "px";
    if ((struct.__parent === position) && (struct.__parent !== struct)) {
        node.classList.add("subordinate");
        var svg = document.querySelector('#svg');
        var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line._reload = function () {
            var nodeBB = node.getBoundingClientRect();
            line.setAttribute('x1', nodeBB.left + (nodeBB.width / 2));
            line.setAttribute('y1', nodeBB.top + (nodeBB.height / 2));
            line.setAttribute('x2', latestHostBB.left + (latestHostBB.width / 2));
            line.setAttribute('y2', latestHostBB.top + (latestHostBB.height / 2));
            line.setAttribute('stroke', 'white');
            line.setAttribute('stroke-width', '1');
        }
        node._line = line;
        svg.appendChild(line);
    }
    if (struct === position) {
        var resizeObserver = new MutationObserver((cb) => {
            struct.width = parseInt(node.style.width.replace("px", ""));
            struct.height = parseInt(node.style.height.replace("px", ""));
            window.onresize();
        });
        resizeObserver.observe(node, {
            childList: false,
            subtree: false,
            attributes: true,
            attributeFilter: ["style"],
            characterData: false
        });
        observers.push(resizeObserver);
    }
    return node;
}
function reloadLocationUI() {
    var locationStack = [position];
    while (locationStack[0].__parent !== locationStack[0]) {
        locationStack.unshift(locationStack[0].__parent);
    }
    document.querySelector("#location").innerText = locationStack.map(x => x.name).join(" / ") + " /";
}
function reloadLayerOffset() {
    position.lx ??= (innerWidth / 2) - position.x - position.width / 2;
    position.ly ??= (innerHeight / 2) - position.y - position.height / 2
    var nodeContainer = document.querySelector("#nodeContainer");
    nodeContainer.style.left = position.lx + "px";
    nodeContainer.style.top = position.ly + "px";
}
function reloadUI() {
    reloadLocationUI();
    reloadLayerOffset();
    var nodeContainer = document.querySelector("#nodeContainer");
    observers.forEach(x => x.disconnect());
    observers = [];
    nodeContainer.innerHTML = "";
    document.querySelector("#svg").innerHTML = "";
    var host = makeNodeHTML(position);
    nodeContainer.appendChild(host);
    latestHostBB = host.getBoundingClientRect();
    position.children.forEach(child => {
        var childNode = makeNodeHTML(child);
        nodeContainer.appendChild(childNode);
        childNode._line._reload();
    });
}
window.addEventListener("load", () => {
    mRenderer = new marked.Renderer();
    mRenderer.link = function (data) {
        return '<a target="_blank" href="' + data.href + (data.title ? '" title="' + data.title : "") + '">' + data.text + '</a>';
    }
    reloadUI();
});
function getSerializeableStateObject() {
    var state2 = structuredClone(state);
    const toDo2 = [state2];
    while (toDo2.length > 0) {
        const currentItem = toDo2[0];
        delete currentItem.__parent;
        toDo2.shift();
        toDo2.push(...currentItem.children);
    }
    return state2;
}
function storeData() {
    localStorage.setItem("data", JSON.stringify(getSerializeableStateObject()));
}
window.addEventListener("beforeunload", () => {
    storeData();
});
window.addEventListener("blur", () => {
    // just in case
    storeData();
});
window.addEventListener("mousemove", (e) => lastMouseEvent = e);
window.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() === "tab") {
        e.preventDefault();
    }

    if (e.shiftKey && (e.key.toLowerCase() === "a") && (e.target === document.body) && !nodeContainerIsDragging) {
        var newNode = {
            name: "New Note",
            content: "",
            x: lastMouseEvent.x - position.lx,
            y: lastMouseEvent.y - position.ly,
            width: 200,
            height: 200,
            children: [],
            __parent: position
        };
        position.children.push(newNode);
        reloadUI();
        e.preventDefault();
        return;
    }
    if (((e.key.toLowerCase() === "backspace") || (e.key.toLowerCase() === "delete")) && (e.target === document.body)) {
        var target = document.elementFromPoint(lastMouseEvent.x, lastMouseEvent.y).closest(".node.subordinate");
        if (target) {
            position.children.splice(position.children.indexOf(target._struct), 1);
        }
        reloadUI();
        e.preventDefault();
        return;
    }
    if (e.shiftKey && (e.key.toLowerCase() === "tab") &&
        ((e.target === document.body) || (e.target.classList.contains("aTitle")) || (e.target.type === "checkbox"))) {
        position = position.__parent;
        reloadUI();
        e.preventDefault();
        return;
    }
    if (!e.shiftKey && (e.key.toLowerCase() === "tab") &&
        ((e.target === document.body) || (e.target.classList.contains("aTitle")) || (e.target.type === "checkbox"))) {
        var target = document.elementFromPoint(lastMouseEvent.x, lastMouseEvent.y).closest(".node.subordinate");
        if (target && (target._struct !== position)) {
            position = target._struct;
            reloadUI();
        }
        e.preventDefault();
        return;
    }
    if (e.ctrlKey && (e.key.toLowerCase() === "s") &&
        ((e.target === document.body) || (e.target.classList.contains("aTitle")))) {
        saveFile();
        e.preventDefault();
        return;
    }
    if (e.ctrlKey && (e.key.toLowerCase() === "o") &&
        ((e.target === document.body) || (e.target.classList.contains("aTitle")))) {
        openFile();
        e.preventDefault();
        return;
    }
    if ((e.key.toLowerCase() === "0") &&
        (e.target === document.body)) {
        console.log(position);
        position.lx = (innerWidth / 2) - position.x - position.width / 2;
        position.ly = (innerHeight / 2) - position.y - position.height / 2;
        reloadLayerOffset();
        svgResize();
        e.preventDefault();
        return;
    }
});
function svgResize() {
    document.querySelector("#svg").setAttribute("viewBox", `0 0 ${window.innerWidth} ${window.innerHeight}`);
    if (document.querySelector(".node:not(.subordinate)")) {
        latestHostBB = document.querySelector(".node:not(.subordinate)").getBoundingClientRect();
        document.querySelectorAll("line").forEach(line => line._reload());
    }
}
var nodeContainerIsDragging = false;
var dragStartPos = { x: 0, y: 0 };
var nodeContainer = document.querySelector("#nodeContainer");
window.addEventListener("mousedown", (e) => {
    if (e.button === 2) {
        dragStartPos = e;
        nodeContainerIsDragging = true;
    }
});
window.addEventListener("mouseup", (e) => {
    if (e.button === 2) {
        position.lx = parseInt(nodeContainer.style.left.replace("px", ""));
        position.ly = parseInt(nodeContainer.style.top.replace("px", ""));
        nodeContainerIsDragging = false;
    }
});
window.addEventListener("mousemove", (e) => {
    if (nodeContainerIsDragging) {
        nodeContainer.style.left = (position.lx || 0) + (e.x - dragStartPos.x) + "px";
        nodeContainer.style.top = (position.ly || 0) + (e.y - dragStartPos.y) + "px";
        svgResize();
    }
});
window.addEventListener("contextmenu", (e) => { e.preventDefault() });
svgResize();
window.addEventListener("resize", svgResize);