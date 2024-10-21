import PropTypes from "prop-types";

export default function DisplayName({ username }) {
    return <div className="display_name">{username}</div>;
};

DisplayName.propTypes = {
    username: PropTypes.string
}