package com.sismics.docs.core.dao.jpa.criteria;


/**
 * Route step criteria.
 *
 * @author bgamard
 */
public class RouteStepCriteria {
    /**
     * Document ID.
     */
    private String documentId;

    /**
     * Route ID.
     */
    private String routeId;

    /**
     * Route ID.
     */
    private String routeStepId;

    /**
     * End date is null.
     */
    private Boolean endDateIsNull;

    public String getDocumentId() {
        return documentId;
    }

    public RouteStepCriteria setDocumentId(String documentId) {
        this.documentId = documentId;
        return this;
    }

    public String getRouteId() {
        return routeId;
    }

    public RouteStepCriteria setRouteId(String routeId) {
        this.routeId = routeId;
        return this;
    }

    public String getRouteStepId() {
        return routeStepId;
    }

    public RouteStepCriteria setRouteStepId(String routeStepId) {
        this.routeStepId = routeStepId;
        return this;
    }

    public Boolean getEndDateIsNull() {
        return endDateIsNull;
    }

    public RouteStepCriteria setEndDateIsNull(Boolean endDateIsNull) {
        this.endDateIsNull = endDateIsNull;
        return this;
    }
}
