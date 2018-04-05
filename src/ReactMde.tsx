import * as React from "react";
import {Command, GenerateMarkdownPreview, MdeState} from "./types";
import {getDefaultCommands} from "./commands";
import {layoutMap, LayoutMap} from "./LayoutMap";
import {ContentState, EditorState} from "draft-js";
import {MarkdownState} from "./types/MarkdownState";
import {
    buildSelectionState,
    getMarkdownStateFromDraftState, getMdeStateFromDraftState,
} from "./util/DraftUtil";

export interface ReactMdeProps {
    editorState: MdeState;
    className?: string;
    commands?: Command[][];
    onChange: (value: MdeState) => void;
    generateMarkdownPreview: GenerateMarkdownPreview;
    layout?: keyof LayoutMap;
    layoutOptions?: any;
}

export class ReactMde extends React.Component<ReactMdeProps> {

    static defaultProps: Partial<ReactMdeProps> = {
        commands: getDefaultCommands(),
        layout: "vertical",
    };

    handleOnChange = ({markdown, html, draftEditorState}: MdeState) => {
        const {onChange} = this.props;
        onChange({markdown, html, draftEditorState});
    }

    handleDraftStateChange = (draftEditorState: EditorState) => {
        const { generateMarkdownPreview } = this.props;
        getMdeStateFromDraftState(draftEditorState, generateMarkdownPreview)
            .then((mdeState) => {
                this.handleOnChange({
                    html: mdeState.html,
                    markdown: mdeState.markdown,
                    draftEditorState,
                });
            });
    }

    onCommand = (command: Command) => {
        command.execute(
            // get markdown state
            () => getMarkdownStateFromDraftState(this.props.editorState.draftEditorState),
            // set markdown state
            ({text, selection}: MarkdownState) => {
                // TODO: Fix the redo. It's no working properly but this is an implementation detail.
                const {editorState: {draftEditorState}, generateMarkdownPreview} = this.props;
                let newDraftEditorState;

                // handling text change history push
                const contentState = ContentState.createFromText(text);
                newDraftEditorState = EditorState.forceSelection(draftEditorState, draftEditorState.getSelection());
                newDraftEditorState = EditorState.push(newDraftEditorState, contentState, "insert-characters");

                // handling text selection history push
                const newSelectionState = buildSelectionState(newDraftEditorState.getCurrentContent(), selection);
                newDraftEditorState = EditorState.forceSelection(newDraftEditorState, newSelectionState);

                this.handleDraftStateChange(newDraftEditorState);
            },
            // get draft state
            () => this.props.editorState.draftEditorState,
            // set draft state
            (draftEditorState: EditorState) => this.handleDraftStateChange(draftEditorState),
        );
    }

    async componentDidMount() {
        const {editorState, generateMarkdownPreview} = this.props;
        if (editorState && !editorState.draftEditorState) {
            const newEditorState: MdeState = {
                html: editorState.html,
                markdown: editorState.markdown,
                draftEditorState: EditorState.createWithContent(ContentState.createFromText(editorState.markdown)),
            };
            if (newEditorState.markdown && !newEditorState.html) {
                newEditorState.html = await generateMarkdownPreview(newEditorState.markdown);
            }
            this.handleOnChange(newEditorState);
        }
    }

    render() {
        const Layout = layoutMap[this.props.layout];
        const {commands, layoutOptions} = this.props;
        let {editorState} = this.props;
        if (!editorState) {
            editorState = {
                html: "",
                markdown: "",
                draftEditorState: EditorState.createEmpty(),
            };
        }
        return (
            <div className="react-mde">
                <Layout
                    onChange={this.handleDraftStateChange}
                    onCommand={this.onCommand}
                    commands={commands}
                    layoutOptions={layoutOptions}
                    mdeEditorState={editorState}
                />
            </div>
        );
    }
}
